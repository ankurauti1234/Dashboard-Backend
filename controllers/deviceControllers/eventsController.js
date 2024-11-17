const Events = require("../../models/Events");
const Location = require("../../models/Location");
const axios = require("axios");
const { sendAlertNotification } = require("../../services/notificationService");

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
      deviceId, // New parameter for single device ID
      type,
    } = req.query;

    const filters = {};

    // Handle single deviceId query
    if (deviceId) {
      filters.DEVICE_ID = Number(deviceId);
    }
    // Only apply deviceIdRange if deviceId is not specified
    else if (deviceIdRange) {
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

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching latest event:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getUniqueDevicesWithLatestEvent = async (req, res) => {
  try {
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
        $replaceRoot: {
          newRoot: "$latestEvent",
        },
      },
      {
        $project: { DEVICE_ID: 1, Event_Name: 1, TS: 1, Type: 1, Details: 1 },
      },
    ]);

    res.status(200).json({ totalDevices: result.length, devices: result });
  } catch (error) {
    console.error("Error fetching unique devices with latest events:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    const { deviceIdRange, types } = req.query;

    // Base query object
    const baseQuery = {};

    // Handle device ID range filter
    if (deviceIdRange) {
      const [minId, maxId] = deviceIdRange.split("-").map(Number);
      if (!isNaN(minId) && !isNaN(maxId)) {
        baseQuery.DEVICE_ID = { $gte: minId, $lte: maxId };
      }
    }

    // Handle event types filter
    let typeArray = [];
    if (types) {
      typeArray = types
        .split(",")
        .map(Number)
        .filter((type) => !isNaN(type));
      if (typeArray.length > 0) {
        baseQuery.Type = { $in: typeArray };
      }
    }

    // Parallel execution of aggregation queries for better performance
    const [totalDevices, totalEvents, eventTypeBreakdown] = await Promise.all([
      // Get total number of unique devices
      Events.distinct("DEVICE_ID", baseQuery),

      // Get total number of events
      Events.countDocuments(baseQuery),

      // Get breakdown of events by type
      Events.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              type: "$Type",
              eventName: "$Event_Name",
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            type: "$_id.type",
            eventName: "$_id.eventName",
            count: 1,
          },
        },
        { $sort: { type: 1 } },
      ]),
    ]);

    // Prepare response
    const response = {
      metrics: {
        totalUniqueDevices: totalDevices.length,
        totalEvents: totalEvents,
        eventsByType: eventTypeBreakdown,
      },
      filters: {
        deviceIdRange: deviceIdRange || "all",
        types: types ? typeArray : "all",
      },
    };

    // Add min and max device IDs if they exist
    if (totalDevices.length > 0) {
      response.metrics.deviceIdRange = {
        min: Math.min(...totalDevices),
        max: Math.max(...totalDevices),
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getLogoDetectionEvents = async (req, res) => {
  try {
    const {
      deviceId,
      deviceIdRange,
      detectionType,
      page = 1,
      limit = 50,
      startDate,
      endDate,
    } = req.query;

    // Validate detection type if provided
    const validDetectionTypes = [
      "tv",
      "game",
      "brand",
      "ott_content",
      "ott_platform",
      "rutube",
      "celebrity",
      "unspecified",
    ];

    if (detectionType && !validDetectionTypes.includes(detectionType)) {
      return res.status(400).json({
        message: `Invalid detection type. Valid types are: ${validDetectionTypes.join(
          ", "
        )}`,
      });
    }

    // Build base query
    const query = {
      Type: 29, // LOGO_DETECTED
    };

    // Handle device ID filtering
    if (deviceId) {
      // Single device ID
      query.DEVICE_ID = Number(deviceId);
    } else if (deviceIdRange) {
      // Device ID range
      const [minId, maxId] = deviceIdRange.split("-").map(Number);
      if (!isNaN(minId) && !isNaN(maxId)) {
        query.DEVICE_ID = { $gte: minId, $lte: maxId };
      } else {
        return res.status(400).json({
          message:
            "Invalid device ID range format. Use format: minId-maxId (e.g., 100000-100010)",
        });
      }
    }

    // Add detection type filter if provided
    if (detectionType) {
      query["Details.detection_type"] = detectionType;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      query.TS = {};
      if (startDate) {
        // Set time to start of day (00:00:00)
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        query.TS.$gte = startDateTime.getTime();
      }
      if (endDate) {
        // Set time to end of day (23:59:59.999)
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query.TS.$lte = endDateTime.getTime();
      }
    }

    // Execute main query with pagination
    const [events, totalCount, detectionTypeCounts] = await Promise.all([
      Events.find(query)
        .select({
          DEVICE_ID: 1,
          Type: 1,
          TS: 1,
          "Details.channel_id": 1,
          "Details.detection_type": 1,
          _id: 0,
        })
        .sort({ TS: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),

      Events.countDocuments(query),

      // Get breakdown of detection types
      Events.aggregate([
        {
          $match: {
            Type: 29,
            ...(query.DEVICE_ID && { DEVICE_ID: query.DEVICE_ID }),
          },
        },
        {
          $group: {
            _id: "$Details.detection_type",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            type: "$_id",
            count: 1,
          },
        },
        {
          $sort: { count: -1 },
        },
      ]),
    ]);

    // Get unique channel IDs and their counts
    const channelStats = await Events.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: "$Details.channel_id",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          channelId: "$_id",
          count: 1,
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Get device ID range statistics
    const deviceStats = await Events.aggregate([
      {
        $match: query,
      },
      {
        $group: {
          _id: null,
          minDeviceId: { $min: "$DEVICE_ID" },
          maxDeviceId: { $max: "$DEVICE_ID" },
          uniqueDevices: { $addToSet: "$DEVICE_ID" },
        },
      },
      {
        $project: {
          _id: 0,
          minDeviceId: 1,
          maxDeviceId: 1,
          uniqueDeviceCount: { $size: "$uniqueDevices" },
        },
      },
    ]);

    // Format the response
    const response = {
      metadata: {
        total: totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / limit),
        filters: {
          deviceId: deviceId || null,
          deviceIdRange: deviceIdRange || null,
          detectionType: detectionType || "all",
          dateRange: {
            startDate: startDate
              ? new Date(startDate).toISOString().split("T")[0]
              : null,
            endDate: endDate
              ? new Date(endDate).toISOString().split("T")[0]
              : null,
          },
        },
      },
      statistics: {
        devices: deviceStats[0] || {
          minDeviceId: null,
          maxDeviceId: null,
          uniqueDeviceCount: 0,
        },
        detectionTypes: detectionTypeCounts,
        channels: channelStats,
      },
      events: events.map((event) => ({
        DEVICE_ID: event.DEVICE_ID,
        Type: event.Type,
        TS: event.TS,
        timestamp: new Date(event.TS).toISOString(), // Added human-readable timestamp
        Details: {
          channel_id: event.Details.channel_id,
          detection_type: event.Details.detection_type,
        },
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching logo detection events:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};