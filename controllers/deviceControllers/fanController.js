// controllers/deviceControllers/fanController.js
const FanState = require("../../models/FanState");
const mqttService = require("../../services/mqttService");

exports.toggleFan = async (req, res) => {
  try {
    const { state } = req.body;

    // Publish the fan control message via MQTT
    await mqttService.publish("fan/control", { state });

    // Update the fan state in the database
    const fanState = new FanState({ state });
    await fanState.save();

    res.json({ message: "Fan state updated successfully", state });
  } catch (error) {
    console.error("Error in toggleFan:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getFanState = async (req, res) => {
  try {
    const latestState = await FanState.findOne().sort({ timestamp: -1 });
    res.json({ state: latestState ? latestState.state : false });
  } catch (error) {
    console.error("Error in getFanState:", error);
    res.status(500).json({ message: error.message });
  }
};
