// services/mqttService.js
const mqtt = require("mqtt");
const mqttConfig = require("../config/mqtt");
const EventsController = require("../controllers/deviceControllers/eventsController");
const Esp32Controller = require("../controllers/deviceControllers/esp32Controller");
const ConfigController = require("../controllers/deviceControllers/configController");
const FanState = require("../models/FanState");

class MqttService {
  constructor() {
    this.client = null;
    this.topics = ["apm/server", "esp32/data", "apm/config", "fan/control"];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds
  }

  async connect() {
    try {
      this.verifyCertificates();

      const options = {
        ...mqttConfig,
        rejectUnauthorized: true,
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30000,
        clean: true,
      };

      console.log("Attempting to connect to MQTT broker:");

      return new Promise((resolve, reject) => {
        this.client = mqtt.connect(
          `mqtts://${mqttConfig.host}:${mqttConfig.port}`,
          options
        );

        this.client.on("connect", () => {
          console.log("Successfully connected to MQTT broker");
          this.reconnectAttempts = 0;
          this.subscribe();
          resolve();
        });

        this.client.on("error", (error) => {
          console.error("MQTT connection error:", error.message);
          this.handleConnectionError(error);
          reject(error);
        });

        this.client.on("offline", () => {
          console.log("MQTT client is offline");
          this.handleOffline();
        });

        this.client.on("reconnect", () => {
          console.log("Attempting to reconnect to MQTT broker...");
        });

        this.client.on("message", this.handleMessage.bind(this));
      });
    } catch (error) {
      console.error("Failed to initialize MQTT connection:", error);
      throw error;
    }
  }

  verifyCertificates() {
    const requiredEnvVars = [
      { key: "AWS_IOT_PRIVATE_KEY", name: "Private Key" },
      { key: "AWS_IOT_CERTIFICATE", name: "Certificate" },
      { key: "AWS_IOT_ROOT_CA", name: "CA Certificate" },
    ];

    requiredEnvVars.forEach(({ key, name }) => {
      if (!process.env[key]) {
        throw new Error(`${name} not found in environment variables: ${key}`);
      }

      try {
        // Verify that the environment variable contains valid base64 data
        const cert = Buffer.from(process.env[key], "base64").toString();
        if (!cert.includes("BEGIN") || !cert.includes("END")) {
          throw new Error(`${name} appears to be invalid`);
        }
      } catch (error) {
        throw new Error(`Invalid ${name} format: ${error.message}`);
      }
    });
  }

  handleConnectionError(error) {
    this.reconnectAttempts++;
    console.error(
      `Connection attempt ${this.reconnectAttempts} failed:`,
      error.message
    );

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "Max reconnection attempts reached. Please check your configuration and certificates."
      );
      this.disconnect();
    }
  }

  handleOffline() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error.message);
        });
      }, this.reconnectInterval);
    }
  }

  subscribe() {
    this.topics.forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Error subscribing to ${topic}:`, err);
        } else {
          console.log(`Successfully subscribed to ${topic}`);
        }
      });
    });
  }

  async handleMessage(topic, message) {
    let payload;
    try {
      payload = JSON.parse(message.toString());
      console.log(`Received message on topic ${topic}:`, payload);

      switch (topic) {
        case "apm/server":
          await EventsController.saveEventData(payload);
          break;
        case "esp32/data":
          await Esp32Controller.saveEsp32Data(payload);
          break;
        case "apm/config":
          await ConfigController.saveConfigData(payload);
          break;
        case "fan/control":
          // Save fan state to database when control message is received
          const fanState = new FanState({
            state: payload.state,
          });
          await fanState.save();
          console.log("Fan state saved:", payload.state);
          break;
        default:
          console.warn(`Unhandled topic: ${topic}`);
      }
    } catch (error) {
      console.error(`Error processing message for topic ${topic}:`, error);
      console.error("Problem message:", message.toString());
    }
  }

  disconnect() {
    if (this.client && this.client.connected) {
      console.log("Disconnecting from MQTT broker...");
      this.client.end(true, {}, () => {
        console.log("Successfully disconnected from MQTT broker");
      });
    }
  }

  publish(topic, message) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        reject(new Error("MQTT client is not connected"));
        return;
      }

      this.client.publish(
        topic,
        JSON.stringify(message),
        { qos: 1 },
        (error) => {
          if (error) {
            console.error(`Error publishing to ${topic}:`, error);
            reject(error);
          } else {
            console.log(`Successfully published to ${topic}`);
            resolve();
          }
        }
      );
    });
  }
}

module.exports = new MqttService();
