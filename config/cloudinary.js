const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  // cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  // api_key: process.env.CLOUDINARY_API_KEY,
  // api_secret: process.env.CLOUDINARY_API_SECRET,
  cloud_name: "dmgrdgvcf",
  api_key: "584794279171491",
  api_secret: "US4u1met2cABd0FwZssZ-z0UhG8",
});

module.exports = cloudinary;
