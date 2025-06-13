const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/news
 * @desc    Lấy danh sách bài viết
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Xây dựng điều kiện lọc
    const conditions = [];
    const queryParams = [];
    
    // Lọc theo danh mục
    if (req.query.category_id) {
      conditions.push('n.news_category_id = ?');
      queryParams.push(Number(req.query.category_id));
    }
    
    // Lọc theo từ khóa
    if (req.query.keyword) {
      conditions.push('(n.news_title LIKE ? OR n.news_content LIKE ?)');
      const keyword = `%${req.query.keyword}%`;
      queryParams.push(keyword, keyword);
    }
    
    // Lọc theo trạng thái (chỉ Admin mới có thể xem bài viết chưa công khai)
    if (req.user && req.user.isAdmin) {
      if (req.query.status) {
        conditions.push('n.news_status = ?');
        queryParams.push(req.query.status);
      }
    } else {
      conditions.push('n.news_status = 1'); // Assuming 1 means published
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Đếm tổng số bài viết
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total 
      FROM news n
      ${whereClause}
    `, queryParams);
    
    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);
    
    // Lấy danh sách bài viết
    const paginationParams = [...queryParams, offset, limit];
    const [news] = await db.query(`
      SELECT 
        n.*
      FROM news n
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `, paginationParams);
    
    // Xử lý dữ liệu trước khi trả về
    const processedNews = news.map(item => {
      // Tạo excerpt từ nội dung
      if (item.news_content && !item.news_description) {
        item.news_description = item.news_content.substring(0, 150) + '...';
      }
      
      return item;
    });
    
    res.json({
      news: processedNews,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});
router.get('/views', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lấy danh sách tin theo view tăng dần, phân trang
    const [news] = await db.query(`
      SELECT n.*
      FROM news n
      ORDER BY n.news_view DESC
      LIMIT ?, ?
    `, [offset, limit]);

    // Trả về dữ liệu có trong response
    res.json({
      news,
      pagination: {
        currentPage: page,
        newsPerPage: limit
        // Có thể thêm tổng số tin nếu cần
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách tin theo view:', error);
    res.status(500).json({ error: 'Lấy danh sách tin thất bại' });
  }
});
/**
 * @route   GET /api/news/:id
 * @desc    Lấy chi tiết bài viết
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Hỗ trợ tìm theo ID hoặc slug
    const isNumeric = /^\d+$/.test(id);
    
    let query;
    let params;
    
    if (isNumeric) {
      query = 'n.news_id = ?';
      params = [Number(id)];
    } else {
      query = 'n.news_slug = ?';
      params = [id];
    }
    
    // Lấy thông tin bài viết
    const [news] = await db.query(`
      SELECT 
        n.*,
        u.user_name as author_name,
        u.user_gmail as author_email,
        COUNT(DISTINCT c.comment_id) as comment_count
      FROM news n
      LEFT JOIN user u ON n.author_id = u.user_id
      LEFT JOIN comment c ON c.news_id = n.news_id
      WHERE n.news_id = ?
      GROUP BY n.news_id
    `, [id]);
    
    if (news.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    const newsItem = news[0];
    
    // Kiểm tra quyền truy cập với bài viết chưa công khai
    if (newsItem.news_status !== 1 && (!req.user || !req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to access this article' });
    }
    
    // Tăng lượt xem
    await db.query('UPDATE news SET news_view = news_view + 1 WHERE news_id = ?', [newsItem.news_id]);
    
    // Lấy bài viết liên quan
    const [relatedNews] = await db.query(`
      SELECT 
        n.*,
        u.user_name as author_name,
        u.user_gmail as author_email
      FROM news n
      LEFT JOIN user u ON n.author_id = u.user_id
      WHERE n.news_category_id = ? AND n.news_id != ?
      ORDER BY n.created_at DESC
      LIMIT 5
    `, [newsItem.news_category_id, newsItem.news_id]);
    
    res.json({
      ...newsItem,
      related_news: relatedNews
    });
  } catch (error) {
    console.error('Error fetching news article:', error);
    res.status(500).json({ error: 'Failed to fetch news article' });
  }
});

/**
 * @route   GET /api/news/category/:categoryId
 * @desc    Lấy bài viết theo danh mục
 * @access  Public
 */
router.get('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    // Phân trang
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Đếm tổng số bài viết trong danh mục
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total 
      FROM news n
      WHERE n.news_category_id = ? AND n.news_status = 1
    `, [categoryId]);
    
    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);
    
    // Lấy danh sách bài viết
    const [news] = await db.query(`
      SELECT n.*
      FROM news n
      WHERE n.news_category_id = ? AND n.news_status = 1
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `, [categoryId, offset, limit]);
    
    res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching news by category:', error);
    res.status(500).json({ error: 'Failed to fetch news by category' });
  }
});

/**
 * @route   POST /api/news
 * @desc    Tạo bài viết mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      thumbnail,
      category_id,
      tags,
      status,
      meta_title,
      meta_description
    } = req.body;
    
    // Kiểm tra các trường bắt buộc
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Tạo slug từ tiêu đề nếu không được cung cấp
    let newsSlug = slug;
    if (!newsSlug) {
      newsSlug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    
    // Kiểm tra slug đã tồn tại chưa
    const [existingSlugs] = await db.query('SELECT id FROM news WHERE slug = ?', [newsSlug]);
    
    if (existingSlugs.length > 0) {
      // Thêm timestamp vào slug để đảm bảo tính duy nhất
      newsSlug = `${newsSlug}-${Date.now().toString().slice(-6)}`;
    }
    
    // Xử lý tags
    let tagString = null;
    if (tags) {
      if (Array.isArray(tags)) {
        tagString = JSON.stringify(tags);
      } else if (typeof tags === 'string') {
        try {
          // Nếu đã là chuỗi JSON
          JSON.parse(tags);
          tagString = tags;
        } catch (e) {
          // Nếu là chuỗi thường, chuyển thành mảng rồi chuyển thành JSON
          tagString = JSON.stringify(tags.split(',').map(tag => tag.trim()));
        }
      }
    }
    
    // Tạo bài viết mới
    const [result] = await db.query(`
      INSERT INTO news (
        title, 
        slug, 
        content, 
        excerpt, 
        thumbnail, 
        news_category_id, 
        author_id, 
        tags, 
        news_status, 
        meta_title, 
        meta_description, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      title,
      newsSlug,
      content,
      excerpt || null,
      thumbnail || null,
      category_id || null,
      req.user.id,
      tagString,
      status || 'draft',
      meta_title || title,
      meta_description || excerpt || (content ? content.substring(0, 160) : null)
    ]);
    
    // Lấy thông tin bài viết vừa tạo
    const [newNews] = await db.query(`
      SELECT 
        n.*,
        u.name as author_name,
        c.name as category_name
      FROM news n
      LEFT JOIN user u ON n.author_id = u.user_id
      LEFT JOIN news_categories c ON n.news_category_id = c.id
      WHERE n.id = ?
    `, [result.insertId]);
    
    const newsItem = newNews[0];
    
    // Chuyển đổi tags từ chuỗi JSON thành mảng
    if (newsItem.tags && typeof newsItem.tags === 'string') {
      try {
        newsItem.tags = JSON.parse(newsItem.tags);
      } catch (e) {
        newsItem.tags = [];
      }
    }
    
    res.status(201).json({
      message: 'News article created successfully',
      news: newsItem
    });
  } catch (error) {
    console.error('Error creating news article:', error);
    res.status(500).json({ error: 'Failed to create news article' });
  }
});

/**
 * @route   PUT /api/news/:id
 * @desc    Cập nhật bài viết
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid news ID' });
    }
    
    const {
      title,
      slug,
      content,
      excerpt,
      thumbnail,
      category_id,
      tags,
      status,
      meta_title,
      meta_description
    } = req.body;
    
    // Kiểm tra bài viết tồn tại
    const [existingNews] = await db.query('SELECT * FROM news WHERE id = ?', [id]);
    
    if (existingNews.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    const newsItem = existingNews[0];
    
    // Kiểm tra slug
    let newsSlug = slug;
    if (newsSlug && newsSlug !== newsItem.slug) {
      // Kiểm tra slug mới có trùng không
      const [existingSlugs] = await db.query('SELECT id FROM news WHERE slug = ? AND id != ?', [newsSlug, id]);
      
      if (existingSlugs.length > 0) {
        // Thêm timestamp vào slug để đảm bảo tính duy nhất
        newsSlug = `${newsSlug}-${Date.now().toString().slice(-6)}`;
      }
    }
    
    // Xử lý tags
    let tagString = newsItem.tags;
    if (tags !== undefined) {
      if (tags === null) {
        tagString = null;
      } else if (Array.isArray(tags)) {
        tagString = JSON.stringify(tags);
      } else if (typeof tags === 'string') {
        try {
          // Nếu đã là chuỗi JSON
          JSON.parse(tags);
          tagString = tags;
        } catch (e) {
          // Nếu là chuỗi thường, chuyển thành mảng rồi chuyển thành JSON
          tagString = JSON.stringify(tags.split(',').map(tag => tag.trim()));
        }
      }
    }
    
    // Cập nhật bài viết
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    
    if (newsSlug !== undefined) {
      updates.push('slug = ?');
      values.push(newsSlug);
    }
    
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    
    if (excerpt !== undefined) {
      updates.push('excerpt = ?');
      values.push(excerpt || null);
    }
    
    if (thumbnail !== undefined) {
      updates.push('thumbnail = ?');
      values.push(thumbnail || null);
    }
    
    if (category_id !== undefined) {
      updates.push('news_category_id = ?');
      values.push(category_id || null);
    }
    
    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(tagString);
    }
    
    if (status !== undefined) {
      updates.push('news_status = ?');
      values.push(status);
    }
    
    if (meta_title !== undefined) {
      updates.push('meta_title = ?');
      values.push(meta_title || null);
    }
    
    if (meta_description !== undefined) {
      updates.push('meta_description = ?');
      values.push(meta_description || null);
    }
    
    updates.push('updated_at = NOW()');
    
    if (updates.length === 1 && updates[0] === 'updated_at = NOW()') {
      return res.status(400).json({ error: 'No update data provided' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE news SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Lấy thông tin bài viết đã cập nhật
    const [updatedNews] = await db.query(`
      SELECT 
        n.*,
        u.name as author_name,
        c.name as category_name
      FROM news n
      LEFT JOIN user u ON n.author_id = u.user_id
      LEFT JOIN news_categories c ON n.news_category_id = c.id
      WHERE n.id = ?
    `, [id]);
    
    const updatedNewsItem = updatedNews[0];
    
    // Chuyển đổi tags từ chuỗi JSON thành mảng
    if (updatedNewsItem.tags && typeof updatedNewsItem.tags === 'string') {
      try {
        updatedNewsItem.tags = JSON.parse(updatedNewsItem.tags);
      } catch (e) {
        updatedNewsItem.tags = [];
      }
    }
    
    res.json({
      message: 'News article updated successfully',
      news: updatedNewsItem
    });
  } catch (error) {
    console.error('Error updating news article:', error);
    res.status(500).json({ error: 'Failed to update news article' });
  }
});

/**
 * @route   DELETE /api/news/:id
 * @desc    Xóa bài viết
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid news ID' });
    }
    
    // Kiểm tra bài viết tồn tại
    const [existingNews] = await db.query('SELECT * FROM news WHERE id = ?', [id]);
    
    if (existingNews.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    // Xóa bài viết
    await db.query('DELETE FROM news WHERE id = ?', [id]);
    
    res.json({ message: 'News article deleted successfully' });
  } catch (error) {
    console.error('Error deleting news article:', error);
    res.status(500).json({ error: 'Failed to delete news article' });
  }
});

module.exports = router; 