// server/config/mqtt.js
const Buffer = require("buffer").Buffer;

/**
 * Converts a base64 string from environment variable to a temporary file or buffer
 * @param {string} base64Data - The base64 encoded certificate/key data
 * @returns {Buffer} The decoded buffer
 */
const getCredentialBuffer = (base64Data) => {
  if (!base64Data) {
    throw new Error(
      "Required credential is missing from environment variables"
    );
  }
  return Buffer.from(base64Data, "base64");
};

// Configuration object
const mqttConfig = {
  host: process.env.AWS_IOT_ENDPOINT,
  port: 8883,
  protocol: "mqtts",
  protocolVersion: 5,
  clientId: `mqtt_${Math.random().toString(16).slice(3)}`,

  // Option 1: Using raw buffer credentials (preferred for most MQTT clients)
  key: getCredentialBuffer(process.env.AWS_IOT_PRIVATE_KEY),
  cert: getCredentialBuffer(process.env.AWS_IOT_CERTIFICATE),
  ca: getCredentialBuffer(process.env.AWS_IOT_ROOT_CA),

  // Option 2: Using credential strings (for clients that accept string format)
  // key: process.env.AWS_IOT_PRIVATE_KEY,
  // cert: process.env.AWS_IOT_CERTIFICATE,
  // ca: process.env.AWS_IOT_ROOT_CA,
};

module.exports = mqttConfig;
