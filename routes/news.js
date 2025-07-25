const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

/**
 * @route   GET /api/news
 * @desc    Lấy danh sách bài viết
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    const queryParams = [];

    // Lọc theo danh mục
    if (req.query.category_id) {
      conditions.push("n.news_category_id = ?");
      queryParams.push(Number(req.query.category_id));
    }

    // Lọc theo từ khóa
    if (req.query.keyword) {
      conditions.push("(n.news_title LIKE ? OR n.news_content LIKE ?)");
      const keyword = `%${req.query.keyword}%`;
      queryParams.push(keyword, keyword);
    }

    // Lọc theo trạng thái
    if (req.user && req.user.isAdmin) {
      if (req.query.status) {
        conditions.push("n.news_status = ?");
        queryParams.push(req.query.status);
      }
    } else {
      conditions.push("n.news_status = 1");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Đếm tổng số bài viết
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) as total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
    `,
      queryParams
    );

    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);

    // Lấy danh sách bài viết kèm tên danh mục
    const paginationParams = [...queryParams, offset, limit];
    const [news] = await db.query(
      `
      SELECT 
        n.*,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `,
      paginationParams
    );

    const processedNews = news.map((item) => {
      if (item.news_content && !item.news_description) {
        item.news_description = item.news_content.substring(0, 150) + "...";
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
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/simple", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    const queryParams = [];

    if (req.query.category_id) {
      conditions.push("n.news_category_id = ?");
      queryParams.push(Number(req.query.category_id));
    }

    if (req.query.keyword) {
      conditions.push("n.news_title LIKE ?");
      const keyword = `%${req.query.keyword}%`;
      queryParams.push(keyword);
    }

    if (req.user && req.user.isAdmin) {
      if (req.query.status) {
        conditions.push("n.news_status = ?");
        queryParams.push(req.query.status);
      }
    } else {
      conditions.push("n.news_status = 1");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countResult] = await db.query(
      `
      SELECT COUNT(*) as total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
    `,
      queryParams
    );

    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);

    const paginationParams = [...queryParams, offset, limit];
    const [newsRaw] = await db.query(
      `
      SELECT 
        n.news_id,
        n.news_image,
        n.news_title,
        n.news_slug,
        n.news_view,
        n.news_status,
        n.created_at,
        n.updated_at,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `,
      paginationParams
    );

    const news = newsRaw.map((item) => {
      return {
        news_id: item.news_id,
        news_image: item.news_image,
        news_title: item.news_title,
        news_slug: item.news_slug,
        news_view: item.news_view,
        news_status: item.news_status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        category_name: item.category_name,
      };
    });

    res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    const queryParams = [];

    if (req.query.category_id) {
      conditions.push("n.news_category_id = ?");
      queryParams.push(Number(req.query.category_id));
    }

    if (req.query.keyword) {
      conditions.push("n.news_title LIKE ?");
      const keyword = `%${req.query.keyword}%`;
      queryParams.push(keyword);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countResult] = await db.query(
      `
      SELECT COUNT(*) as total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
    `,
      queryParams
    );

    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);

    const paginationParams = [...queryParams, offset, limit];
    const [newsRaw] = await db.query(
      `
      SELECT 
        n.news_id,
        n.news_image,
        n.news_title,
        n.news_slug,
        n.news_view,
        n.news_status,
        n.created_at,
        n.updated_at,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `,
      paginationParams
    );

    const news = newsRaw.map((item) => {
      return {
        news_id: item.news_id,
        news_image: item.news_image,
        news_title: item.news_title,
        news_slug: item.news_slug,
        news_view: item.news_view,
        news_status: item.news_status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        category_name: item.category_name,
      };
    });

    res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/views", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lấy danh sách tin theo view tăng dần, phân trang
    const [news] = await db.query(
      `
      SELECT n.*
      FROM news n
      ORDER BY n.news_view DESC
      LIMIT ?, ?
    `,
      [offset, limit]
    );

    // Trả về dữ liệu có trong response
    res.json({
      news,
      pagination: {
        currentPage: page,
        newsPerPage: limit,
        // Có thể thêm tổng số tin nếu cần
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách tin theo view:", error);
    res.status(500).json({ error: "Lấy danh sách tin thất bại" });
  }
});
/**
 * @route   GET /api/news/:id
 * @desc    Lấy chi tiết bài viết
 * @access  Public
 */
// router.get('/:id', async (req, res) => {
//   try {
//     const id = req.params.id;

//     // Hỗ trợ tìm theo ID hoặc slug
//     const isNumeric = /^\d+$/.test(id);

//     let query;
//     let params;

//     if (isNumeric) {
//       query = 'n.news_id = ?';
//       params = [Number(id)];
//     } else {
//       query = 'n.news_slug = ?';
//       params = [id];
//     }

//     // Lấy thông tin bài viết
//     const [news] = await db.query(`
//       SELECT
//         n.*,
//         u.user_name as author_name,
//         u.user_gmail as author_email,
//         COUNT(DISTINCT c.comment_id) as comment_count
//       FROM news n
//       LEFT JOIN user u ON n.author_id = u.user_id
//       LEFT JOIN comment c ON c.news_id = n.news_id
//       WHERE n.news_id = ?
//       GROUP BY n.news_id
//     `, [id]);

//     if (news.length === 0) {
//       return res.status(404).json({ error: 'News article not found' });
//     }

//     const newsItem = news[0];

//     // Kiểm tra quyền truy cập với bài viết chưa công khai
//     if (newsItem.news_status !== 1 && (!req.user || !req.user.isAdmin)) {
//       return res.status(403).json({ error: 'You do not have permission to access this article' });
//     }

//     // Tăng lượt xem
//     await db.query('UPDATE news SET news_view = news_view + 1 WHERE news_id = ?', [newsItem.news_id]);

//     // Lấy bài viết liên quan
//     const [relatedNews] = await db.query(`
//       SELECT
//         n.*,
//         u.user_name as author_name,
//         u.user_gmail as author_email
//       FROM news n
//       LEFT JOIN user u ON n.author_id = u.user_id
//       WHERE n.news_category_id = ? AND n.news_id != ?
//       ORDER BY n.created_at DESC
//       LIMIT 5
//     `, [newsItem.news_category_id, newsItem.news_id]);

//     res.json({
//       ...newsItem,
//       related_news: relatedNews
//     });
//   } catch (error) {
//     console.error('Error fetching news article:', error);
//     res.status(500).json({ error: 'Failed to fetch news article' });
//   }
// });

/**
 * @route   GET /api/news/category/:categoryId
 * @desc    Lấy bài viết theo danh mục
 * @access  Public
 */
router.get("/category/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);

    if (isNaN(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    // Phân trang
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Đếm tổng số bài viết trong danh mục
    const [countResult] = await db.query(
      `
      SELECT COUNT(*) as total 
      FROM news n
      WHERE n.news_category_id = ? AND n.news_status = 1
    `,
      [categoryId]
    );

    const totalNews = countResult[0].total;
    const totalPages = Math.ceil(totalNews / limit);

    // Lấy danh sách bài viết
    const [news] = await db.query(
      `
      SELECT n.*
      FROM news n
      WHERE n.news_category_id = ? AND n.news_status = 1
      ORDER BY n.created_at DESC
      LIMIT ?, ?
    `,
      [categoryId, offset, limit]
    );

    res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching news by category:", error);
    res.status(500).json({ error: "Failed to fetch news by category" });
  }
});

/**
 * @route   POST /api/news
 * @desc    Tạo bài viết mới
 * @access  Private (Admin only)
 */

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, slug, content, images, category_id, status } = req.body;

    if (!title || !content) {
      return res
        .status(400)
        .json({ error: "Tiêu đề và nội dung là bắt buộc." });
    }

    if (!images) {
      return res.status(400).json({ error: "Ảnh là bắt buộc." });
    }

    // Tạo slug từ title nếu không có, hoặc chuẩn hóa slug người nhập
    let newsSlug = generateSlug(slug || title);

    // Kiểm tra trùng slug trong DB
    const [slugExists] = await db.query(
      "SELECT news_id FROM news WHERE news_slug = ?",
      [newsSlug]
    );
    if (slugExists.length > 0) {
      newsSlug = `${newsSlug}-${Date.now().toString().slice(-6)}`;
    }

    // INSERT không cần trường excerpt nữa
    const [result] = await db.query(
      `
        INSERT INTO news (
          news_title,
          news_slug,
          news_content,
          news_image,
          news_category_id,
          news_author,
          news_comment,
          news_status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())
      `,
      [
        title,
        newsSlug,
        content,
        images,
        category_id || null,
        req.user.id,
        status || 1,
      ]
    );

    const [newNews] = await db.query(
      `
      SELECT 
        n.*, 
        u.user_name AS author_name,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN user u ON n.news_author = u.user_id
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      WHERE n.news_id = ?
    `,
      [result.insertId]
    );

    res.status(201).json({
      message: "Tạo tin tức thành công.",
      news: newNews[0],
    });
  } catch (error) {
    console.error("Lỗi tạo tin tức:", error);
    res.status(500).json({ error: "Không thể tạo tin tức." });
  }
});

/**
 * @route   PUT /api/news/:id
 * @desc    Cập nhật bài viết
 * @access  Private (Admin only)
 */
// GET /api/news/:slug
router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    // Tăng view trước khi lấy dữ liệu
    await db.query(
      `UPDATE news SET news_view = news_view + 1 WHERE news_slug = ?`,
      [slug]
    );

    const [result] = await db.query(
      `SELECT *
      FROM news WHERE news_slug = ?`,
      [slug]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "News not found" });
    }

    const newsItem = result[0];

    res.json(newsItem);
  } catch (err) {
    console.error("Error fetching news by slug:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/news/:slug
router.put("/:slug", verifyToken, async (req, res) => {
  try {
    const slugParam = req.params.slug;
    const [existingNews] = await db.query(
      "SELECT * FROM news WHERE news_slug = ?",
      [slugParam]
    );

    if (existingNews.length === 0) {
      return res.status(404).json({ error: "News article not found" });
    }

    const newsItem = existingNews[0];
    const id = newsItem.news_id;

    const {
      title,
      slug,
      content,
      images,
      category_id,
      tags,
      status,
      meta_title,
      meta_description,
    } = req.body;

    // Slug logic
    let newsSlug = slug;
    if (!slug && title) {
      newsSlug = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/\-+/g, "-");
    }

    if (newsSlug && newsSlug !== newsItem.news_slug) {
      const [slugExists] = await db.query(
        "SELECT news_id FROM news WHERE news_slug = ? AND news_id != ?",
        [newsSlug, id]
      );
      if (slugExists.length > 0) {
        newsSlug = `${newsSlug}-${Date.now().toString().slice(-4)}`;
      }
    }

    // Tags xử lý
    let tagString = newsItem.tags;
    if (tags !== undefined) {
      if (tags === null) tagString = null;
      else if (Array.isArray(tags)) tagString = JSON.stringify(tags);
      else if (typeof tags === "string") {
        try {
          JSON.parse(tags);
          tagString = tags;
        } catch {
          tagString = JSON.stringify(tags.split(",").map((tag) => tag.trim()));
        }
      }
    }

    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push("news_title = ?");
      values.push(title);
    }
    if (newsSlug !== undefined) {
      updates.push("news_slug = ?");
      values.push(newsSlug);
    }
    if (content !== undefined) {
      updates.push("news_content = ?");
      values.push(content);
    }
    if (category_id !== undefined) {
      updates.push("news_category_id = ?");
      values.push(category_id || null);
    }
    if (tags !== undefined) {
      updates.push("tags = ?");
      values.push(tagString);
    }
    if (status !== undefined) {
      updates.push("news_status = ?");
      values.push(status);
    }
    if (meta_title !== undefined) {
      updates.push("meta_title = ?");
      values.push(meta_title || null);
    }
    if (meta_description !== undefined) {
      updates.push("meta_description = ?");
      values.push(meta_description || null);
    }

    // Xử lý ảnh
    const newImages = Array.isArray(images)
      ? images.filter(Boolean).slice(0, 5)
      : [];

    if (newImages.length > 0) {
      updates.push("news_image = ?");
      values.push(JSON.stringify(newImages));
    }

    values.push(id);

    if (updates.length === 0) {
      return res.status(400).json({ error: "No update data provided" });
    }

    await db.query(
      `UPDATE news SET ${updates.join(", ")} WHERE news_id = ?`,
      values
    );

    // Lấy lại bản ghi đã cập nhật
    const [updatedNews] = await db.query(
      `
      SELECT 
        n.*, 
        u.user_name AS author_name,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN user u ON n.news_author = u.user_id
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      WHERE n.news_id = ?
    `,
      [id]
    );

    const updatedNewsItem = updatedNews[0];

    // Parse ảnh (news_image) và tags
    if (
      updatedNewsItem.news_image &&
      typeof updatedNewsItem.news_image === "string"
    ) {
      try {
        updatedNewsItem.images = JSON.parse(updatedNewsItem.news_image);
      } catch {
        updatedNewsItem.images = [];
      }
    }

    if (updatedNewsItem.tags && typeof updatedNewsItem.tags === "string") {
      try {
        updatedNewsItem.tags = JSON.parse(updatedNewsItem.tags);
      } catch {
        updatedNewsItem.tags = [];
      }
    }

    res.json({
      message: "News article updated successfully",
      news: updatedNewsItem,
    });
  } catch (error) {
    console.error("Error updating news article:", error);
    res.status(500).json({ error: "Failed to update news article" });
  }
});

/**
 * @route   DELETE /api/news/:id
 * @desc    Xóa bài viết
 * @access  Private (Admin only)
 */
// Hàm lấy ảnh trong nội dung
function getImageInContent(content) {
  const imgRegex = /<img[^>]+src=['"]([^'"]+)['"]/g;
  let matches;
  const links = [];
  while ((matches = imgRegex.exec(content)) !== null) {
    links.push(matches[1]);
  }
  return links;
}

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID tin tức không hợp lệ" });
    }

    const [existingNews] = await db.query(
      "SELECT * FROM news WHERE news_id = ?",
      [id]
    );

    if (existingNews.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy tin tức" });
    }

    const { news_image, news_content } = existingNews[0];
    let imageUrl = news_image;
    let imagesInContent = getImageInContent(news_content);

    try {
      const arr = JSON.parse(news_image);
      if (Array.isArray(arr) && arr.length > 0) {
        imageUrl = arr[0];
      }
    } catch (err) {}

    // Hàm lấy publicId Cloudinary
    const getCloudinaryPublicId = (url) => {
      if (!url) return null;
      const match = url.match(/\/upload\/v\d+\/(.+?)\.(jpg|jpeg|png|webp)$/i);
      return match ? match[1] : null;
    };

    // Xóa ảnh cover (nếu có)
    const publicId = getCloudinaryPublicId(imageUrl);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
      // console.log("Đã xóa ảnh Cloudinary:", publicId);
    }

    // Xóa ảnh trong nội dung
    if(Array.isArray(imagesInContent)) {
      for(const url of imagesInContent) {
        const publicIdInContent = getCloudinaryPublicId(url);
        if (publicIdInContent) {
          await cloudinary.uploader.destroy(publicIdInContent);
          // console.log("Đã xóa ảnh Cloudinary trong nội dung:", publicIdInContent);
        }
      }
    }

    await db.query("DELETE FROM news WHERE news_id = ?", [id]);

    res.json({ message: "Xóa tin tức thành công" });
  } catch (error) {
    console.error("Lỗi xóa tin tức:", error);
    res.status(500).json({ error: "Lỗi xóa tin tức" });
  }
});

module.exports = router;
