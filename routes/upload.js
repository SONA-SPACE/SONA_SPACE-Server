const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

router.post("/category", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh" });

    const { folder, subfolder } = req.body;
    const base64Image = `data:${req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

    // Ghép folder đầy đủ
    const targetFolder = subfolder ? `${folder}/${subfolder}` : folder;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: targetFolder,
    });

    res.status(200).json({
      message: "Upload thành công",
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Lỗi upload ảnh", detail: error.message });
  }
});

router.post("/room", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh" });

    const { folder, subfolder } = req.body;
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;


    // Ghép folder đầy đủ
    const targetFolder = subfolder ? `${folder}/${subfolder}` : folder;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: targetFolder,
    });


    res.status(200).json({
      message: "Upload thành công",
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Lỗi upload ảnh", detail: error.message });
  }
});

router.post("/product", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh" });

    const base64Image = `data:${req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "furnitown/category",
    });

    res.status(200).json({
      message: "Upload thành công",
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Lỗi upload ảnh", detail: error.message });
  }
});

router.post("/news", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Thiếu file ảnh" });

    const base64Image = `data:${req.file.mimetype
      };base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "furnitown/category",
    });

    res.status(200).json({
      message: "Upload thành công",
      url: result.secure_url,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Lỗi upload ảnh", detail: error.message });
  }
});

module.exports = router;
