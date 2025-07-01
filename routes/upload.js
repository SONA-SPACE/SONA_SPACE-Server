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
    if (!req.file) {
      console.error("[UPLOAD] Không nhận được file ảnh từ client", req.body);
      return res.status(400).json({ error: "Thiếu file ảnh" });
    }

    const folder = req.body.folder || "SonaSpace/Product";
    const subfolder = req.body.subfolder || "";
    const targetFolder = subfolder ? `${folder}/${subfolder}` : folder;
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    let result;
    try {
      result = await cloudinary.uploader.upload(base64Image, {
        folder: targetFolder,
      });
    } catch (cloudErr) {
      console.error("[UPLOAD] Lỗi upload lên cloudinary:", cloudErr);
      return res.status(500).json({ error: "Lỗi upload cloudinary", detail: cloudErr.message });
    }

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

    const { folder = "SonaSpace", subfolder = "News" } = req.body;

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const targetFolder = subfolder ? `${folder}/${subfolder}` : folder;

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: targetFolder,
    });

    res.status(200).json({ message: "Upload thành công", url: result.secure_url });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Lỗi upload ảnh", detail: error.message });
  }
});

router.post("/newscategorynews", upload.single("image"), async (req, res) => {
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
module.exports = router;
