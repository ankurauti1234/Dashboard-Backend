const Events = require("../../models/Events");
const Location = require("../../models/Location");
const axios = require("axios");
const { sendAlertNotification } = require("../../services/notificationService");
const NodeCache = require("node-cache");

// Create a cache instance
const cache = new NodeCache({ stdTTL: 600 }); // Cache TTL set to 600 seconds (10 minutes)

// Mapping of Type to Event Name
const eventTypeMapping = {
  1: "LOCATION",
  2: "GUEST_REGISTRATION",
  3: "MEMBER_GUEST_DECLARATION",
  4: "CONFIGURATION",
  5: "TAMPER_ALARM",
  6: "SOS_ALARM",
  7: "BATTERY_ALARM",
  8: "METER_INSTALLATION",
  9: "VOLTAGE_STATS",
  10: "TEMPERATURE_STATS",
  11: "NTP_SYNC",
  12: "AUDIENCE_SESSION_CLOSE",
  13: "NETWORK_LATCH",
  14: "REMOTE_PAIRING",
  15: "REMOTE_ACTIVITY",
  16: "SIM_ALERT",
  17: "SYSTEM_ALARM",
  18: "SYSTEM_INFO",
  19: "CONFIG_UPDATE",
  20: "ALIVE",
  21: "METER_OTA",
  22: "BATTERY_VOLTAGE",
  23: "BOOT",
  24: "BOOT_V2",
  25: "STB",
  26: "DERIVED_TV_STATUS",
  27: "AUDIO_SOURCE",
  28: "AUDIO_FINGERPRINT",
  29: "LOGO_DETECTED",
};

const alertTypes = [5, 6, 7, 16, 17]; // Event types that are considered alerts

const convertLocationToLatLon = async (cellInfo) => {
  const { mcc, mnc, lac, cid } = cellInfo.cell_towers;

  const unwiredLabsPayload = {
    token: "pk.c4f2e3d84bcc6bae8333620bb3eaf8e1", // Replace with your actual token
    radio: "gsm",
    mcc: mcc,
    mnc: mnc,
    cells: [{ lac, cid }],
    address: 1,
  };

  try {
    const response = await axios.post(
      "https://unwiredlabs.com/v2/process.php",
      unwiredLabsPayload
    );

    if (response.data.status === "ok") {
      const { lat, lon, accuracy, address } = response.data;
      return {
        latitude: lat,
        longitude: lon,
        accuracy,
        address,
      };
    } else {
      throw new Error("Geolocation service error");
    }
  } catch (error) {
    console.error("Error in location conversion:", error);
    throw error;
  }
};

exports.saveEventData = async (payload) => {
  if (!payload.DEVICE_ID || !payload.ID || !payload.TS || !payload.Type) {
    throw new Error("Invalid apm/device message format");
  }

  const eventName = eventTypeMapping[payload.Type] || "UNKNOWN_EVENT";

  const eventData = {
    ID: payload.ID,
    DEVICE_ID: payload.DEVICE_ID,
    TS: payload.TS,
    Type: payload.Type,
    Event_Name: eventName,
    Details: payload.Details || {},
  };

  if (alertTypes.includes(payload.Type)) {
    eventData.AlertType = "generated";
    sendAlertNotification(eventData);
  }

  // Check if the event already exists based on unique fields (e.g., ID, DEVICE_ID, and TS)
  const existingEvent = await Events.findOne({
    ID: payload.ID,
    DEVICE_ID: payload.DEVICE_ID,
    TS: payload.TS,
  });

  if (!existingEvent) {
    await Events.create(eventData);
  } else {
    console.log("Duplicate event detected, not saving:", eventData);
  }

  // Handle Type 1 LOCATION event
  if (payload.Type === 1 && payload.Details && payload.Details.cell_info) {
    try {
      const geoLocation = await convertLocationToLatLon(
        payload.Details.cell_info
      );

      const locationData = {
        DEVICE_ID: payload.DEVICE_ID,
        ...geoLocation,
        lastUpdated: new Date(),
      };

      await Location.findOneAndUpdate(
        { DEVICE_ID: payload.DEVICE_ID },
        locationData,
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Error processing location data:", error);
    }
  }
};

// API to get all events with pagination and search
exports.getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      deviceIdRange = "",
      type,
    } = req.query;

    const cacheKey = `allEvents_${page}_${limit}_${search}_${deviceIdRange}_${type}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const filters = {};

    // Search by DEVICE_ID range if specified
    if (deviceIdRange) {
      const [minId, maxId] = deviceIdRange.split("-").map(Number);
      filters.DEVICE_ID = { $gte: minId, $lte: maxId };
    }

    // Search by Type if specified
    if (type) {
      filters.Type = type;
    }

    // Global search in Event_Name and Details
    const searchRegex = new RegExp(search, "i"); // Case insensitive
    const searchQuery = {
      $or: [
        { Event_Name: searchRegex },
        { "Details.description": searchRegex }, // Assuming Details has a description field
      ],
    };

    // Combine filters with search query
    const query = { ...filters, ...searchQuery };

    const events = await Events.find(query)
      .sort({ TS: -1 }) // Latest on top
      .skip((page - 1) * limit) // Pagination skip
      .limit(Number(limit)); // Pagination limit

    const totalEvents = await Events.countDocuments(query); // Total count for pagination

    const response = {
      total: totalEvents,
      page: Number(page),
      limit: Number(limit),
      events,
    };

    // Cache the response
    cache.set(cacheKey, response);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getDeviceEvents = async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const { page = 1, limit = 10, startDate, endDate, type } = req.query;

    if (!deviceId) {
      return res.status(400).json({ message: "Device ID is required" });
    }

    // Build query filters
    const filters = {
      DEVICE_ID: isNaN(deviceId) ? deviceId : Number(deviceId),
    };

    // Add date range filter if provided
    if (startDate || endDate) {
      filters.TS = {};
      if (startDate) filters.TS.$gte = new Date(startDate);
      if (endDate) filters.TS.$lte = new Date(endDate);
    }

    // Add event type filter if provided
    if (type) {
      filters.Type = Number(type);
    }

    // Create a cache key for device events
    const cacheKey = `deviceEvents_${deviceId}_${page}_${limit}_${startDate}_${endDate}_${type}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Get events with pagination
    const events = await Events.find(filters)
      .sort({ TS: -1 }) // Latest events first
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Get total count for pagination
    const totalEvents = await Events.countDocuments(filters);

    // Check if any events were found
    if (events.length === 0) {
      return res.status(404).json({
        message:
          "No events found for this device ID with the specified criteria",
      });
    }

    const response = {
      deviceId,
      total: totalEvents,
      page: Number(page),
      limit: Number(limit),
      events,
    };

    // Cache the response
    cache.set(cacheKey, response);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching device events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getLatestEventByType = async (req, res) => {
  try {
    const { deviceId, type } = req.query;

    if (!deviceId) {
      return res.status(400).json({ message: "Device ID is required" });
    }

    if (!type) {
      return res.status(400).json({ message: "Event type is required" });
    }

    // Convert deviceId to number if it's numeric
    const numericDeviceId = isNaN(deviceId) ? deviceId : Number(deviceId);

    // Create a cache key for the latest event
    const cacheKey = `latestEvent_${numericDeviceId}_${type}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Fetch the latest event
    const event = await Events.findOne({
      DEVICE_ID: numericDeviceId,
      Type: Number(type),
    }).sort({ TS: -1 }); // Sort by latest timestamp and fetch only one

    // Check if an event was found
    if (!event) {
      return res
        .status(404)
        .json({ message: "No events found for this device ID and event type" });
    }

    const response = {
      deviceId: numericDeviceId,
      type: Number(type),
      event,
    };

    // Cache the response
    cache.set(cacheKey, response);

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching latest event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getUniqueDevicesWithLatestEvent = async (req, res) => {
  try {
    const cacheKey = "uniqueDevicesWithLatestEvents";
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const result = await Events.aggregate([
      {
        $sort: { DEVICE_ID: 1, Type: 1, TS: -1 },
      },
      {
        $group: {
          _id: { DEVICE_ID: "$DEVICE_ID", Type: "$Type" },
          latestEvent: { $first: "$$ROOT" },
        },
      },
      {
        $group: {
          _id: "$_id.DEVICE_ID",
          latestEvents: {
            $push: {
              type: "$_id.Type",
              event: "$latestEvent",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          deviceId: "$_id",
          latestEvents: 1,
        },
      },
    ]);

    // Process the result to create the desired structure
    const devices = result.map((device) => ({
      deviceId: device.deviceId,
      latestEvents: device.latestEvents.reduce((acc, curr) => {
        acc[curr.type] = curr.event;
        return acc;
      }, {}),
    }));

    const response = {
      totalDevices: devices.length,
      devices: devices,
    };

    // Cache the response
    cache.set(cacheKey, response, 300); // Cache for 5 minutes

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching unique devices with latest events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};