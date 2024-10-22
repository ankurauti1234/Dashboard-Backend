const express = require("express");
const router = express.Router();
const eventsController = require("../controllers/deviceControllers/eventsController");
const alertsController = require("../controllers/deviceControllers/alertsController");
const liveMonitorController = require("../controllers/deviceControllers/liveMonitorController");
const {
  getLatestDeviceLocation,
} = require("../controllers/deviceControllers/locationController");

// Existing routes
router.post("/events", async (req, res) => {
  try {
    await eventsController.saveEventData(req.body);
    res.status(201).json({ message: "Event data saved successfully." });
  } catch (error) {
    console.error("Error saving event data:", error);
    res.status(400).json({ message: error.message });
  }
});

router.get("/", eventsController.getAllEvents);
router.get("/alerts", alertsController.getAlerts);
router.get("/location/:deviceId", getLatestDeviceLocation);
router.get("/latest", eventsController.getLatestEventsByType);
router.get("/afp", liveMonitorController.getAFP);
router.get("/logo", liveMonitorController.getLogo);

// New route for device-specific events
router.get("/:deviceId", eventsController.getDeviceEvents);
router.get(
  "/member-guest/:deviceId",
  eventsController.getLatestMemberGuestEvent
);

module.exports = router;
