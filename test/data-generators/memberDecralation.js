const mqtt = require("mqtt");
const fs = require("fs");
const mqttConfig = require("../../config/mqtt"); // Adjust the path if needed

// MQTT connection options
const options = {
  host: "a3uoz4wfsx2nz3-ats.iot.ap-south-1.amazonaws.com",
  port: 8883,
  protocol: "mqtts",
  protocolVersion: 5,
  clientId: "membersDataClient",
  key: fs.readFileSync(mqttConfig.keyPath),
  cert: fs.readFileSync(mqttConfig.certPath),
  ca: fs.readFileSync(mqttConfig.caPath),
};

// Connect to AWS IoT MQTT broker
const client = mqtt.connect(options);

// Helper function to generate random boolean arrays
function generateBoolArray(length) {
  return Array.from({ length }, () => Math.random() < 0.5);
}

// Initialize ID
let currentID = 1; // Start from ID 23

// Publish message every 5 seconds
client.on("connect", () => {
  console.log("Connected to AWS IoT MQTT broker.");

  setInterval(() => {
    const timestamp = Math.round(Date.now() / 1000);
    const message = {
      ID: currentID++,
      TS: timestamp,
      DEVICE_ID: 100001,
      Type: 3,
      Details: {
        member_keys: generateBoolArray(8), // 8 boolean values
        guests: generateBoolArray(3), // 3 boolean values
      },
    };

    // Publish the message to the MQTT topic
    client.publish(
      "apm/server",
      JSON.stringify(message),
      { qos: 1 },
      (error) => {
        if (error) {
          console.error("Publish error:", error);
        } else {
          console.log("Data sent:", message);
        }
      }
    );
  }, 5000); // Send data every 5 seconds
});

// Handle connection errors
client.on("error", (error) => {
  console.error("MQTT connection error:", error);
});
