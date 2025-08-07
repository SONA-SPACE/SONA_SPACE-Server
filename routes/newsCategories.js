const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
function generateSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

/**
 * @route   GET /api/news-categories
 * @desc    Lấy danh sách danh mục tin tức (generated from news table)
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.status,
        c.image,
        c.priority,
        c.updated_at,
        c.created_at,
        c.deleted_at,
        COUNT(n.news_id) as news_count
      FROM (
        SELECT DISTINCT 
          news_category_id as id,
          CASE 
            WHEN news_category_id IS NULL THEN 'Chưa phân loại'
            ELSE news_category_name
          END as name,
          news_category_slug as slug,
          news_category_status as status,
          news_category_image as image,
          news_category_priority as priority,
          updated_at,
          created_at,
          deleted_at
        FROM news_category
      ) c
      LEFT JOIN news n ON n.news_category_id = c.id
      GROUP BY c.id, c.name, c.slug, c.status, c.image, c.priority, c.updated_at, c.created_at, c.deleted_at
      ORDER BY c.created_at DESC;
    `);

    res.json(results);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/**
 * @route   GET /api/news-categories/:id
 * @desc    Lấy thông tin danh mục tin tức
 * @access  Public
 */

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Slug không hợp lệ." });
    }

    const [rows] = await db.query(
      `
      SELECT 
        news_category_id,
        news_category_name,
        news_category_slug,
        news_category_image,
        news_category_priority,
        news_category_status
      FROM news_category
      WHERE news_category_slug = ?
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy danh mục theo slug." });
    }

    const category = rows[0];

    res.json({
      id: category.news_category_id,
      name: category.news_category_name,
      slug: category.news_category_slug,
      image: category.news_category_image,
      priority: category.news_category_priority,
      status: category.news_category_status,
    });
  } catch (err) {
    console.error("Lỗi khi truy vấn danh mục:", err);
    res.status(500).json({ error: "Lỗi máy chủ." });
  }
});

/**
 * @route   POST /api/news-categories
 * @desc    [Disabled] Tạo danh mục tin tức mới
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  const { name, status = 1, image, priority } = req.body;

  // Validate dữ liệu đầu vào
  if (!name || typeof name !== "string") {
    return res
      .status(400)
      .json({ error: "Tên danh mục là bắt buộc và phải là chuỗi." });
  }

  if (![0, 1].includes(Number(status))) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ." });
  }
  if (!image) {
    return res
      .status(400)
      .json({ error: "Không thể upload danh mục tin không có hình ảnh " });
  }

  if (
    priority === undefined ||
    priority === "" ||
    isNaN(priority) ||
    Number(priority) < 0
  ) {
    return res
      .status(400)
      .json({ error: "Độ ưu tiên là bắt buộc và phải là số >= 0." });
  }

  if (priority < 0 || isNaN(priority)) {
    return res.status(400).json({ error: "Độ ưu tiên không hợp lệ." });
  }

  try {
    const slug = req.body.slug || generateSlug(name);
    const [slugCheck] = await db.query(
      "SELECT * FROM news_category WHERE news_category_slug = ?",
      [slug]
    );

    if (slugCheck.length > 0) {
      return res.status(400).json({
        error: "Slug đã tồn tại, vui lòng nhập tên khác hoặc chỉnh lại slug.",
      });
    }
    const [result] = await db.query(
      `
      INSERT INTO news_category (news_category_name, news_category_slug, news_category_image, news_category_status, news_category_priority)
      VALUES (?, ?, ?, ?, ?)
    `,
      [name, slug, image, status, priority]
    );

    res.status(201).json({
      message: "Tạo danh mục thành công",
      category: {
        id: result.insertId,
        name,
        slug,
        image: image,
        status,
        priority,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tạo danh mục:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi tạo danh mục" });
  }
});

/**
 * @route   PUT /api/news-categories/:id
 * @desc    [Disabled] Cập nhật danh mục tin tức
 * @access  Private (Admin only)
 */
router.put("/:slug", verifyToken, isAdmin, async (req, res) => {
  const { slug: oldSlug } = req.params;
  const { name, slug: newSlug, image = null, priority, status } = req.body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res
      .status(400)
      .json({ error: "Tên danh mục tin là bắt buộc và phải là chuỗi." });
  }

  // Validate slug
  if (!newSlug || typeof newSlug !== "string" || newSlug.trim() === "") {
    return res
      .status(400)
      .json({ error: "Slug mới là bắt buộc và phải là chuỗi." });
  }

  // Validate status
  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ." });
  }

  // Validate priority
  const priorityNumber = Number(priority);
  if (isNaN(priorityNumber) || priorityNumber < 0) {
    return res.status(400).json({ error: "Độ ưu tiên không hợp lệ." });
  }

  try {
    const [result] = await db.query(
      `
      UPDATE news_category
      SET 
        news_category_name = ?,
        news_category_slug = ?,     
        news_category_image = ?,
        news_category_priority = ?,
        news_category_status = ?
      WHERE news_category_slug = ?
    `,
      [
        name.trim(),
        newSlug.trim(),
        image,
        priorityNumber,
        statusNumber,
        oldSlug,
      ]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy danh mục theo slug." });
    }

    res.json({ message: "Cập nhật danh mục thành công." });
  } catch (err) {
    console.error("Lỗi cập nhật danh mục:", err);
    res
      .status(500)
      .json({ error: "Không thể cập nhật danh mục. Vui lòng thử lại." });
  }
});

/**
 * @route   DELETE /api/news-categories/:id
 * @desc    [Disabled] Xóa danh mục tin tức
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({ error: "ID danh mục không hợp lệ" });
    }

    // Kiểm tra danh mục tồn tại
    const [categories] = await db.query(
      `SELECT * FROM news_category WHERE news_category_id = ?`,
      [categoryId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }

    // Kiểm tra xem có bài viết nào đang dùng danh mục này không
    const [usedNews] = await db.query(
      `SELECT COUNT(*) as count FROM news WHERE news_category_id = ?`,
      [categoryId]
    );

    if (usedNews[0].count > 0) {
      return res.status(400).json({
        error: `Không thể xóa danh mục này vì có ${usedNews[0].count} bài viết đang sử dụng.`,
      });
    }

    // Tiến hành xóa
    await db.query(`DELETE FROM news_category WHERE news_category_id = ?`, [
      categoryId,
    ]);

    res.json({ message: "Xoá danh mục thành công" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Không thể xoá danh mục" });
  }
});

// tin tức theo category
router.get("/news/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [id] = await db.query(
      `SELECT news_category_id FROM news_category WHERE news_category_slug = ?`,
      [slug]
    );
    const [rows] = await db.query(
      `SELECT 
        news_id,
        news_image,
        news_slug,
        news_title,
        created_at
        FROM news WHERE news_category_id = ? AND news_status = 1 ORDER BY created_at DESC`,
      [id[0].news_category_id]
    );
    res.json({
      news: rows,
      category: {
        id: id[0].news_category_id,
        name: id[0].news_category_name,
        slug: id[0].news_category_slug,
      },
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

module.exports = router;
