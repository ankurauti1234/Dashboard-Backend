const express = require("express");
const router = express.Router();
const esp32Controller = require("../controllers/deviceControllers/esp32Controller");
const fanController = require("../controllers/deviceControllers/fanController");

router.get("/sensor/live", esp32Controller.getLiveEsp32Data);
router.post("/fan/toggle", fanController.toggleFan);
router.get("/fan/state", fanController.getFanState);

module.exports = router;
