// memberDeclaration.js
const path = require("path");
const mqtt = require("mqtt");
const dotenv = require("dotenv");

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, "../../.env");
console.log("Looking for .env file at:", envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("Error loading .env file:", result.error.message);
  process.exit(1);
}

// Debug: Print available environment variables (without their values for security)
console.log("Available environment variables:", Object.keys(process.env));

// Validate required environment variables
const requiredEnvVars = [
  "AWS_IOT_ENDPOINT",
  "AWS_IOT_PRIVATE_KEY",
  "AWS_IOT_CERTIFICATE",
  "AWS_IOT_ROOT_CA",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingVars.join(", ")
  );
  console.error("Please check your .env file contains these variables");
  process.exit(1);
}

// MQTT connection options
const options = {
  host: process.env.AWS_IOT_ENDPOINT,
  port: 8883,
  protocol: "mqtts",
  protocolVersion: 5,
  clientId: `mqtt_${Math.random().toString(16).slice(3)}`,
  key: Buffer.from(process.env.AWS_IOT_PRIVATE_KEY, "base64"),
  cert: Buffer.from(process.env.AWS_IOT_CERTIFICATE, "base64"),
  ca: Buffer.from(process.env.AWS_IOT_ROOT_CA, "base64"),
  rejectUnauthorized: true,
  keepalive: 60,
  reconnectPeriod: 1000,
  connectTimeout: 30000,
  clean: true,
};

// Connect to AWS IoT MQTT broker
const client = mqtt.connect(options);

// Channel IDs array
const channelIds = [
  "Channel1",
  "Karusel",
  "Kinopoisk",
  "MatchTV",
  "Mir",
  "MuzTV",
  "NTV",
  "OTR",
  "RenTV",
  "Russia24",
  "RussiaK",
  "Spas",
  "TB3",
  "THT",
  "TVCenter",
  "YouTube",
  "Zvezda",
  "STS",
  "NDTV",
];

// Function to generate random data
const generateDummyData = () => {
  const data = {
    ID: Math.floor(Math.random() * 1000) + 1,
    TS: Date.now(), // Real-time timestamp
    Type: 28, // Random Type
    DEVICE_ID: 100000, // Random Type
    Details: {
      channel_id: channelIds[Math.floor(Math.random() * channelIds.length)], // Random channel ID
    },
  };

  return data;
};

// Handle connection
client.on("connect", () => {
  console.log("Connected to AWS IoT MQTT broker");
  console.log("Using endpoint:", process.env.AWS_IOT_ENDPOINT);

  setInterval(() => {
    const message = generateDummyData(); // Generate dummy data

    // Publish the message to the MQTT topic
    const topic = process.env.EVENTS_TOPIC || "apm/server";
    client.publish(topic, JSON.stringify(message), { qos: 1 }, (error) => {
      if (error) {
        console.error("Publish error:", error);
      } else {
        console.log("Data sent:", message);
      }
    });
  }, 5000);
});

// Handle connection errors
client.on("error", (error) => {
  console.error("MQTT connection error:", error);
  console.error("Error details:", error.message);
  if (error.stack) console.error("Stack trace:", error.stack);
});

// Handle disconnection
client.on("close", () => {
  console.log("Disconnected from MQTT broker");
});

// Handle reconnection
client.on("reconnect", () => {
  console.log("Attempting to reconnect to MQTT broker");
});
