const express = require("express");
const router = express.Router();
const eventsController = require("../controllers/deviceControllers/eventsController");
const alertsController = require("../controllers/deviceControllers/alertsController");
const {
  getLatestDeviceLocation,
} = require("../controllers/deviceControllers/locationController");

// Middleware for parsing deviceId
const parseDeviceId = (req, res, next) => {
  const deviceId = req.params.deviceId;
  if (deviceId === "assets") {
    return next();
  }
  const parsedDeviceId = parseInt(deviceId, 10);
  if (isNaN(parsedDeviceId)) {
    return res.status(400).json({ message: "Invalid device ID" });
  }
  req.parsedDeviceId = parsedDeviceId;
  next();
};

// Routes
router.post("/events", async (req, res) => {
  try {
    await eventsController.saveEventData(req.body);
    res.status(201).json({ message: "Event data saved successfully." });
  } catch (error) {
    console.error("Error saving event data:", error);
    res.status(400).json({ message: error.message });
  }
});

router.get("/metrics", eventsController.getMetrics);
router.get("/logo-detection", eventsController.getLogoDetectionEvents);
router.get("/", eventsController.getAllEvents);
router.get("/alerts", alertsController.getAlerts);
router.get("/assets", eventsController.getUniqueDevicesWithLatestEvent);
router.get("/latest", eventsController.getLatestEventByType);
router.get("/location/:deviceId", parseDeviceId, getLatestDeviceLocation);
router.get("/:deviceId", parseDeviceId, eventsController.getDeviceEvents);

module.exports = router;
