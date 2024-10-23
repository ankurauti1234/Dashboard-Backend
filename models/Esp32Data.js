// server/models/Esp32Data.js
const mongoose = require("mongoose");
const esp32DataSchema = new mongoose.Schema({
  distance: Number,
  temperature: Number,
  humidity: Number,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Esp32Data", esp32DataSchema);
