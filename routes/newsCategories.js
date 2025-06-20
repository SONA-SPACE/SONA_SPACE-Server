const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

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
          updated_at as updated_at,
          created_at as created_at,
          deleted_at as deleted_at
        FROM news_category
      ) c
      LEFT JOIN news n ON n.news_category_id = c.id
      GROUP BY c.id, c.name, c.slug , c.status ,  c.updated_at, c.created_at, c.deleted_at
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
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check if any news exists with this category ID and get a sample name
    const [result] = await db.query(`
      SELECT 
        news_category_id as id,
        MIN(news_name) as category_name,
        COUNT(*) as news_count
      FROM news 
      WHERE news_category_id = ?
      GROUP BY news_category_id
    `, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Create a category object with a meaningful name
    const category = {
      id: result[0].id,
      name: result[0].category_name || `Category ${result[0].id}`, // Use sample name or fallback
      news_count: result[0].news_count
    };

    res.json(category);
  } catch (error) {
    console.error('Error fetching news category:', error);
    res.status(500).json({ error: 'Failed to fetch news category' });
  }
});

/**
 * @route   POST /api/news-categories
 * @desc    [Disabled] Tạo danh mục tin tức mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  // Since there's no news_categories table, we can't create new categories
  return res.status(501).json({
    error: 'Creating news categories is not supported',
    message: 'The news_categories table does not exist in the database. Category information is stored directly in the news table.'
  });
});

/**
 * @route   PUT /api/news-categories/:id
 * @desc    [Disabled] Cập nhật danh mục tin tức
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  // Since there's no news_categories table, we can't update categories
  return res.status(501).json({
    error: 'Updating news categories is not supported',
    message: 'The news_categories table does not exist in the database. Category information is stored directly in the news table.'
  });
});

/**
 * @route   DELETE /api/news-categories/:id
 * @desc    [Disabled] Xóa danh mục tin tức
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  // Since there's no news_categories table, we can't delete categories
  return res.status(501).json({
    error: 'Deleting news categories is not supported',
    message: 'The news_categories table does not exist in the database. Category information is stored directly in the news table.'
  });
});

module.exports = router; 