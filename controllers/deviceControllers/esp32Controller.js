const Esp32Data = require("../../models/Esp32Data");

exports.saveEsp32Data = async (payload) => {


  await Esp32Data.create({
    distance: payload.distance,
    temperature: payload.temperature,
    humidity: payload.humidity,
    fan_state: payload.fan_state,
    // timestamp will be automatically added by the schema default
  });
};

exports.getLiveEsp32Data = async (req, res) => {
  try {
    const { page = 1, limit = 10, startTime, endTime } = req.query;
    let query = {};

    if (startTime && endTime) {
      query.timestamp = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const totalCount = await Esp32Data.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    const data = await Esp32Data.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select("distance temperature humidity timestamp"); // Include the temperature and humidity fields

    res.json({
      data: data,
      currentPage: page,
      totalPages,
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
