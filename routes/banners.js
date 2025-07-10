const express = require("express");
const router = express.Router();
const db = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/auth");

// Cấu hình multer để upload hình ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/banners");
    
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "banner-" + uniqueSuffix + ext);
  },
});

// Kiểm tra loại file
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file hình ảnh: jpeg, jpg, png, gif, webp!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: fileFilter,
});

// Middleware xác thực admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
};

// GET: Lấy tất cả banner
router.get("/", async (req, res) => {
  try {
    const [banners] = await db.query(
      "SELECT * FROM banners ORDER BY position ASC, created_at DESC"
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    res.json(banners);
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner theo page_type
router.get("/page/:pageType", async (req, res) => {
  try {
    const pageType = req.params.pageType;
    
    const [banners] = await db.query(
      "SELECT * FROM banners WHERE page_type = ? AND status = 'active' ORDER BY position ASC, created_at DESC",
      [pageType]
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    res.json(banners);
  } catch (error) {
    console.error("Error fetching banners by page type:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST: Lấy banner cho nhiều page_type cùng lúc
router.post("/pages", async (req, res) => {
  try {
    const { pageTypes } = req.body;
    
    if (!pageTypes || !Array.isArray(pageTypes) || pageTypes.length === 0) {
      return res.status(400).json({ error: "pageTypes array is required" });
    }
    
    // Tạo placeholders cho câu query
    const placeholders = pageTypes.map(() => '?').join(',');
    
    const [banners] = await db.query(
      `SELECT * FROM banners WHERE page_type IN (${placeholders}) AND status = 'active' ORDER BY page_type, position ASC, created_at DESC`,
      pageTypes
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    // Nhóm banner theo page_type
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = banners.filter(banner => banner.page_type === pageType);
      return acc;
    }, {});
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching banners by multiple page types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner cho nhiều page_type cùng lúc (qua query string)
router.get("/pages", async (req, res) => {
  try {
    let { types } = req.query;
    
    if (!types) {
      return res.status(400).json({ error: "types query parameter is required" });
    }
    
    // Chuyển đổi từ string sang array nếu cần
    const pageTypes = Array.isArray(types) ? types : types.split(',');
    
    if (pageTypes.length === 0) {
      return res.status(400).json({ error: "At least one page type is required" });
    }
    
    // Tạo placeholders cho câu query
    const placeholders = pageTypes.map(() => '?').join(',');
    
    const [banners] = await db.query(
      `SELECT * FROM banners WHERE page_type IN (${placeholders}) AND status = 'active' ORDER BY page_type, position ASC, created_at DESC`,
      pageTypes
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    // Nhóm banner theo page_type
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = banners.filter(banner => banner.page_type === pageType);
      return acc;
    }, {});
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching banners by multiple page types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy danh sách tất cả các page_type có banner
router.get("/page-types", async (req, res) => {
  try {
    const [result] = await db.query(
      "SELECT DISTINCT page_type FROM banners WHERE status = 'active' ORDER BY page_type"
    );
    
    const pageTypes = result.map(item => item.page_type);
    
    res.json(pageTypes);
  } catch (error) {
    console.error("Error fetching page types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner theo ID
router.get("/:id", async (req, res) => {
  try {
    const [banners] = await db.query("SELECT * FROM banners WHERE id = ?", [
      req.params.id,
    ]);

    if (banners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const banner = banners[0];
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    if (banner.image_url && !banner.image_url.startsWith('http')) {
      banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
    }
    
    res.json(banner);
  } catch (error) {
    console.error("Error fetching banner:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST: Tạo banner mới (yêu cầu xác thực admin)
router.post("/", authMiddleware.verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, link_url, position, status, page_type } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!title || !req.file) {
      return res.status(400).json({ error: "Title and image are required" });
    }
    
    const image_url = req.file ? path.basename(req.file.path) : null;
    
    const [result] = await db.query(
      "INSERT INTO banners (title, subtitle, image_url, link_url, position, status, page_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [title, subtitle || null, image_url, link_url || null, position || 0, status || "active", page_type || "home"]
    );
    
    res.status(201).json({
      id: result.insertId,
      title,
      subtitle,
      image_url: `/uploads/banners/${image_url}`,
      link_url,
      position,
      status,
      page_type: page_type || "home"
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT: Cập nhật banner (yêu cầu xác thực admin)
router.put("/:id", authMiddleware.verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, link_url, position, status, page_type } = req.body;
    const bannerId = req.params.id;
    
    // Kiểm tra banner có tồn tại không
    const [existingBanners] = await db.query("SELECT * FROM banners WHERE id = ?", [bannerId]);
    
    if (existingBanners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    
    const existingBanner = existingBanners[0];
    let image_url = existingBanner.image_url;
    
    // Nếu có upload ảnh mới
    if (req.file) {
      // Xóa ảnh cũ nếu tồn tại và không phải URL bên ngoài
      if (existingBanner.image_url && !existingBanner.image_url.startsWith('http')) {
        const oldImagePath = path.join(__dirname, "../public/uploads/banners", existingBanner.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Cập nhật đường dẫn ảnh mới
      image_url = path.basename(req.file.path);
    }
    
    // Cập nhật banner trong database
    await db.query(
      "UPDATE banners SET title = ?, subtitle = ?, image_url = ?, link_url = ?, position = ?, status = ?, page_type = ?, updated_at = NOW() WHERE id = ?",
      [
        title || existingBanner.title,
        subtitle !== undefined ? subtitle : existingBanner.subtitle,
        image_url,
        link_url !== undefined ? link_url : existingBanner.link_url,
        position !== undefined ? position : existingBanner.position,
        status || existingBanner.status,
        page_type || existingBanner.page_type || "home",
        bannerId
      ]
    );
    
    // Lấy dữ liệu banner sau khi cập nhật
    const [updatedBanners] = await db.query("SELECT * FROM banners WHERE id = ?", [bannerId]);
    const updatedBanner = updatedBanners[0];
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    if (updatedBanner.image_url && !updatedBanner.image_url.startsWith('http')) {
      updatedBanner.image_url = `/uploads/banners/${path.basename(updatedBanner.image_url)}`;
    }
    
    res.json(updatedBanner);
  } catch (error) {
    console.error("Error updating banner:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE: Xóa banner (yêu cầu xác thực admin)
router.delete("/:id", authMiddleware.verifyToken, isAdmin, async (req, res) => {
  try {
    const bannerId = req.params.id;
    
    // Kiểm tra banner có tồn tại không
    const [existingBanners] = await db.query("SELECT * FROM banners WHERE id = ?", [bannerId]);
    
    if (existingBanners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    
    const existingBanner = existingBanners[0];
    
    // Xóa file ảnh nếu tồn tại và không phải URL bên ngoài
    if (existingBanner.image_url && !existingBanner.image_url.startsWith('http')) {
      const imagePath = path.join(__dirname, "../public/uploads/banners", existingBanner.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Xóa banner từ database
    await db.query("DELETE FROM banners WHERE id = ?", [bannerId]);
    
    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
