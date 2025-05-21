require("dotenv").config();
const axios = require("axios");

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

const fetchData = async () => {
  try {
    const response = await axios.get(`${API_URL}/data`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      }
    });
    return response.data;
  } catch (error) {
    console.error("Lỗi khi gọi API:", error.message);
    throw error;
  }
};

module.exports = { fetchData };
