const mongoose = require("mongoose");

const fanStateSchema = new mongoose.Schema({
  state: {
    type: Boolean,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("FanState", fanStateSchema);
