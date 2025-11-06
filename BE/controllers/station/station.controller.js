const Station = require("../../models/station/station.model");
const StationRating = require("../../models/rating/stationRating.model");
const Battery = require("../../models/battery/battery.model");
const { z, ZodError } = require("zod");

const nearbySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().optional().default(5000),
  limit: z.coerce.number().optional().default(50),
});

const listNearbyStations = async (req, res) => {
  try {
    const { lat, lng, radius, limit } = nearbySchema.parse(req.query);

    const stations = await Station.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radius,
          spherical: true,
        },
      },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      radius,
      count: stations.length,
      data: stations.map((s) => ({
        ...s,
        distanceKm: (s.distance / 1000).toFixed(2), // 👉 chuyển sang km
      })),
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: err.errors?.[0]?.message || "Invalid query",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getStationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const station = await Station.findById(id);
    if (!station)
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    const batteries = await Battery.find({
      station: station._id,
      status: { $ne: "faulty" },
    })
      .select("soh status")
      .limit(500);
    const ratingAgg = await StationRating.aggregate([
      { $match: { station: station._id } },
      {
        $group: {
          _id: "$station",
          avgScore: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
    const rating = ratingAgg[0] || { avgScore: null, count: 0 };
    return res
      .status(200)
      .json({
        success: true,
        data: {
          station,
          sohAvg: station.sohAvg,
          available: station.availableBatteries,
          batteries,
          rating,
        },
      });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

const postStationRating = async (req, res) => {
  try {
    const { id } = req.params;
    const body = ratingSchema.parse(req.body);
    const station = await Station.findById(id);
    if (!station)
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    const rating = await StationRating.findOneAndUpdate(
      { station: station._id, user: req.user.id },
      { $set: { rating: body.rating, comment: body.comment } },
      { upsert: true, new: true }
    );
    return res
      .status(201)
      .json({ success: true, data: rating, message: "Rating submitted" });
  } catch (err) {
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors?.[0]?.message || "Invalid input",
        });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listStationRatings = async (req, res) => {
  try {
    const { id } = req.params;
    const station = await Station.findById(id);
    if (!station)
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    const ratings = await StationRating.find({ station: station._id })
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ success: true, data: ratings });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const listAllStations = async (req, res) => {
  try {
    const stations = await Station.find({})
      .select('stationName address city district capacity batteryCounts location')
      .sort({ stationName: 1 });

    return res.status(200).json({
      success: true,
      count: stations.length,
      data: stations
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  listNearbyStations,
  listAllStations,
  getStationDetail,
  postStationRating,
  listStationRatings,
};
