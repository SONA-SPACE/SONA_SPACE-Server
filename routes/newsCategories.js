const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');
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
router.get('/', async (req, res) => {
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
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});


/**
 * @route   GET /api/news-categories/:id
 * @desc    Lấy thông tin danh mục tin tức
 * @access  Public
 */

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Slug không hợp lệ.' });
    }

    const [rows] = await db.query(`
      SELECT 
        news_category_id,
        news_category_name,
        news_category_slug,
        news_category_image,
        news_category_priority,
        news_category_status
      FROM news_category
      WHERE news_category_slug = ?
    `, [slug]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục theo slug.' });
    }

    const category = rows[0];

    res.json({
      id: category.news_category_id,
      name: category.news_category_name,
      slug: category.news_category_slug,
      image: category.news_category_image,
      priority: category.news_category_priority,
      status: category.news_category_status
    });
  } catch (err) {
    console.error('Lỗi khi truy vấn danh mục:', err);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});



/**
 * @route   POST /api/news-categories
 * @desc    [Disabled] Tạo danh mục tin tức mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, async (req, res) => {
  const { name, status = 1, image, priority = 0 } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Tên danh mục là bắt buộc" });
  }

  try {
    const slug = generateSlug(name);

    const [result] = await db.query(`
      INSERT INTO news_category (news_category_name, news_category_slug, news_category_image, news_category_status, news_category_priority)
      VALUES (?, ?, ?, ?, ?)
    `, [name, slug, image || null, status, priority]);

    res.status(201).json({
      message: "Tạo danh mục thành công",
      category: {
        id: result.insertId,
        name,
        slug,
        image: image || null,
        status,
        priority
      }
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
router.put('/:slug', verifyToken, isAdmin, async (req, res) => {
  const { slug: oldSlug } = req.params; // slug cũ
  const { name, slug: newSlug, image, priority, status } = req.body; // slug mới

  try {
    const [result] = await db.query(`
      UPDATE news_category
      SET 
        news_category_name = ?,
        news_category_slug = ?,     
        news_category_image = ?,
        news_category_priority = ?,
        news_category_status = ?
      WHERE news_category_slug = ?
    `, [name, newSlug, image, priority, status, oldSlug]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy danh mục theo slug.' });
    }

    res.json({ message: 'Cập nhật thành công.' });
  } catch (err) {
    console.error('Lỗi cập nhật slug:', err);
    res.status(500).json({ error: 'Không thể cập nhật danh mục.' });
  }
});



/**
 * @route   DELETE /api/news-categories/:id
 * @desc    [Disabled] Xóa danh mục tin tức
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Kiểm tra danh mục tồn tại
    const [categories] = await db.query(
      `SELECT * FROM news_category WHERE news_category_id = ?`,
      [categoryId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Kiểm tra xem có bài viết nào dùng danh mục này không
    const [usedNews] = await db.query(
      `SELECT COUNT(*) as count FROM news WHERE news_category_id = ?`,
      [categoryId]
    );

    if (usedNews[0].count > 0) {
      return res.status(400).json({
        error: `Không thể xóa danh mục này vì có ${usedNews[0].count} bài viết đang sử dụng.`
      });
    }

    // Tiến hành xóa danh mục
    await db.query(`DELETE FROM news_category WHERE news_category_id = ?`, [categoryId]);

    res.json({ message: 'Xoá danh mục thành công' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});


module.exports = router; 