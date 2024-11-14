// index.mjs
import mongoose from "mongoose";
const { Schema } = mongoose;

// Events Schema Definition
const detailsSchema = new Schema(
  {
    rtc_ts: Number,
    ntp_ts: Number,
    cell_ts: Number,
    boot_ts: Number,
    clean: Boolean,
    time_approximated: Boolean,
    events_ignored: Boolean,
    region: String,
    lat: Number,
    lon: Number,
    Installing: Boolean,
    guest_id: Number,
    registering: Boolean,
    guest_age: Number,
    guest_male: Boolean,
    member_keys: Schema.Types.Mixed,
    guests: Schema.Types.Mixed,
    confidence: Number,
    differential_mode: Boolean,
    software_version: String,
    hardware_version: String,
    power_pcb_firmware_version: String,
    remote_firmware_version: String,
    audio_configuration: Schema.Types.Mixed,
    audience_day_start_time: Number,
    no_of_sessions: Number,
    Meter_tamper: Boolean,
    Tv_plug_tamper: Boolean,
    Tamper_ts: Number,
    sos: Boolean,
    main_bat_fail: Boolean,
    rtc_fail: Boolean,
    rtc_bat_low: Boolean,
    HHID: String,
    Success: Boolean,
    high_rail_voltage: Number,
    mid_rail_voltage: Number,
    gsm_rail_voltage: Number,
    rtc_battery_voltage: Number,
    li_ion_battery_voltage: Number,
    remote_battery_voltage: Number,
    battery_temp: Number,
    arm_core_temp: Number,
    power_pcb_temp: Number,
    rtc_temp: Number,
    server: String,
    system_time: Number,
    error_code: Number,
    drift: Number,
    jumped: Boolean,
    stop_time: Number,
    viewing_member_keys: Schema.Types.Mixed,
    viewing_guests: Schema.Types.Mixed,
    tv_on: Boolean,
    last_watermark_id: Number,
    tv_event_ts: Number,
    last_watermark_id_ts: Number,
    marked: Number,
    Ip_up: Boolean,
    Sim: Number,
    remote_id: Number,
    lock: Boolean,
    orr: Boolean,
    absent_key_press: Boolean,
    drop: Boolean,
    sim1_absent: Boolean,
    sim1_changed: Boolean,
    sim2_absent: Boolean,
    sim2_changed: Boolean,
    name: String,
    rpi_serial: String,
    pcb_serial: String,
    imei: String,
    imsi_1: String,
    imsi_2: String,
    eeprom: Number,
    wifi_serial: String,
    mac_serial: String,
    remote_serial: Number,
    key: String,
    value: String,
    old_value: String,
    state: Schema.Types.Mixed,
    previous: String,
    update: String,
    Rtc: Number,
    Meter: Number,
    last_boot_ts: Number,
    last_shutdown_ts: Number,
    Status: String,
    channel_id: String,
    accuracy: Number,
    gender: Schema.Types.Mixed,
    age: Schema.Types.Mixed,
    ID: Number,
  },
  { _id: false, strict: false }
);

const eventsSchema = new Schema(
  {
    DEVICE_ID: { type: Number, required: true },
    TS: { type: Number, required: true },
    Type: { type: Number, required: true },
    Details: detailsSchema,
    timestamp: { type: Date, default: Date.now },
  },
  {
    strict: false,
    timeseries: {
      timeField: "timestamp",
      metaField: "DEVICE_ID",
      granularity: "seconds",
    },
  }
);

// Create indexes optimized for time series queries
eventsSchema.index({ timestamp: 1, DEVICE_ID: 1 }, { background: true });
eventsSchema.index({ Type: 1, timestamp: 1 }, { background: true });

let Events;
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    // Configure MongoDB connection with appropriate options for time series
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    // Create the model with time series collection options
    if (!mongoose.models.Events) {
      Events = mongoose.model("Events", eventsSchema, "events", {
        timeSeriesCollection: true,
        expireAfterSeconds: process.env.DATA_RETENTION_SECONDS || 7776000, // 90 days default
      });
    } else {
      Events = mongoose.models.Events;
    }

    cachedDb = connection;
    console.log("Successfully connected to MongoDB Time Series collection");
    return connection;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

export const handler = async (event) => {
  try {
    console.log("Received event:", JSON.stringify(event));

    // Connect to MongoDB
    await connectToDatabase();

    // Parse the incoming IoT message
    let message;
    if (event.Records && event.Records[0].Sns) {
      message = JSON.parse(event.Records[0].Sns.Message);
    } else {
      message = event;
    }

    console.log("Parsed message:", JSON.stringify(message));

    // Ensure timestamp field is properly set for time series
    if (!message.timestamp) {
      message.timestamp = new Date(message.TS ? message.TS * 1000 : Date.now());
    }

    // Add Event_Name based on Type
    if (message.Type in eventTypeMapping) {
      message.Event_Name = eventTypeMapping[message.Type];
    }

    // Check if Type is in alertTypes array and add AlertType if needed
    if (alertTypes.includes(message.Type)) {
      message.AlertType = "generated";
    }

    // Create a new event document with the modified message
    const newEvent = new Events(message);

    // Save to MongoDB with write concern appropriate for time series
    await newEvent.save({ writeConcern: { w: 1, j: false } });
    console.log("Successfully saved event to MongoDB Time Series collection");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Event saved successfully",
        eventId: newEvent._id,
        timestamp: newEvent.timestamp,
      }),
    };
  } catch (error) {
    console.error("Error in Lambda handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
    };
  }
};
