// server/models/Events.js
const mongoose = require("mongoose");

const detailsSchema = new mongoose.Schema(
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
    member_keys: { type: mongoose.Schema.Types.Mixed, default: undefined },
    guests: { type: mongoose.Schema.Types.Mixed, default: undefined },
    confidence: Number,
    differential_mode: Boolean,
    software_version: String,
    hardware_version: String,
    power_pcb_firmware_version: String,
    remote_firmware_version: String,
    audio_configuration: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    audience_day_start_time: Number,
    no_of_sessions: Number,
    Meter_tamper: Boolean,
    Tv_plug_tamper: Boolean,
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
    viewing_member_keys: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    viewing_guests: { type: mongoose.Schema.Types.Mixed, default: undefined },
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
    state: Boolean,
    previous: String,
    update: String,
    Rtc: Number,
    Meter: Number,
    last_boot_ts: Number,
    last_shutdown_ts: Number,
    Status: String,
    channel_id: String,
    accuracy:Number,
    //currently added for APM display demo
    state: { type: mongoose.Schema.Types.Mixed, default: undefined },
    gender: { type: mongoose.Schema.Types.Mixed, default: undefined },
    age: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false, strict: false }
);

const eventsSchema = new mongoose.Schema(
  {
    ID: { type: Number, required: true },
    DEVICE_ID: { type: Number, required: true },
    TS: { type: Number, required: true },
    Type: { type: Number, required: true },
    AlertType: String,
    Details: detailsSchema,
    timestamp: { type: Date, default: Date.now },
  },
  { strict: false }
);

// Indexes for better query performance
eventsSchema.index({ DEVICE_ID: 1, TS: -1 });
eventsSchema.index({ Type: 1 });

const Events = mongoose.model("Events", eventsSchema);

module.exports = Events;
