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

// Channel IDs array
const channelIds = [
  "Channel1",
  "Russia1 (0 orbit)",
  "Russia1 (Moscow Orbit)",
  "NTV",
  "Channel5",
  "RussiaK",
  "Russia24",
  "Karusel",
  "OTR",
  "TVCenter",
  "RenTV",
  "Spas",
  "STS",
  "Domashny",
  "TV-3",
  "TNT",
  "Pyatnica",
  "Zvezda",
  "MIR",

  "GodOfWar",
  "Minecraft",
  "PUBG",
  "Roblox",
  "Tekken",
  "FIFA",

  "Nike",
  "Puma",
  "Adidas",
  "Emirates",
  "Rakuten",
  "Audi",
  "Hankook",
  "Samsumg",
  "boundelle",
  "magnit",
  "flamenco",
  "dodo",

  "TriKota",

  "VKTube",
  "Rutube",
  "Youtube",
  "Kinopoisk",
  "NBN",
  "Wink",

  "Russia1",
  "Russia24",
  "Solntce",
  "MatchTV",
  "MuzTV",

  "vladimir_putin",
  "mikhail_mishustin",
  "random_person",
];

// Helper function to generate random number within range
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to generate random data
const generateDummyData = () => {
  const data = [];
  for (let i = 0; i < 1; i++) {
    data.push({
      ID: Math.floor(Math.random() * 1000) + 1,
      TS: Math.round(Date.now() / 1000),
      Type: 29,
      DEVICE_ID: getRandomInt(100000, 100010),
      // DEVICE_ID: getRandomInt(100000, 100010),
      Details: {
        channel_id: channelIds[Math.floor(Math.random() * channelIds.length)],
        accuracy: parseFloat(Math.random().toFixed(2)),
      },
    });
  }
  return data;
};

// Connect to AWS IoT MQTT broker
const client = mqtt.connect(options);

// Handle connection
client.on("connect", () => {
  console.log("Connected to AWS IoT MQTT broker");
  console.log("Using endpoint:", process.env.AWS_IOT_ENDPOINT);

  setInterval(() => {
    const messages = generateDummyData();
    const topic = process.env.EVENTS_TOPIC || "apm/server";

    messages.forEach((message) => {
      client.publish(topic, JSON.stringify(message), { qos: 1 }, (error) => {
        if (error) {
          console.error("Publish error:", error);
        } else {
          console.log("Data sent:", message);
        }
      });
    });
  }, 1000); // Send data every 1 second
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
