const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

/**
 * @route   GET /api/comments
 * @desc    Lấy danh sách bình luận/đánh giá
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lọc theo sản phẩm nếu có
    const productFilter = req.query.product_id
      ? `WHERE c.product_id = ${Number(req.query.product_id)}`
      : "";

    // Đếm tổng số bình luận
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total 
      FROM comment
      ${productFilter.replace("c.", "")}
    `);

    const totalComments = countResult[0].total;
    const totalPages = Math.ceil(totalComments / limit);

    // Lấy danh sách bình luận - removed users table join
    const [comments] = await db.query(
      `
      SELECT 
        c.*,
        p.product_name
      FROM comment c
      LEFT JOIN product p ON c.product_id = p.product_id
      ${productFilter}
      ORDER BY c.created_at DESC
      LIMIT ?, ?
    `,
      [offset, limit]
    );

    // Add a placeholder for user_name since the users table doesn't exist
    const commentsWithPlaceholder = comments.map((comment) => ({
      ...comment,
      user_name: `User ${comment.user_id}`,
    }));

    res.json({
      comments: commentsWithPlaceholder,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

/**
 * @route   GET /api/comments/:id
 * @desc    Lấy chi tiết bình luận
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }

    // Removed users table join
    const [comments] = await db.query(
      `
      SELECT 
        c.*,
        p.product_name
      FROM comment c
      LEFT JOIN product p ON c.product_id = p.product_id
      WHERE c.id = ?
    `,
      [id]
    );

    if (comments.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Add a placeholder for user_name
    const comment = {
      ...comments[0],
      user_name: `User ${comments[0].user_id}`,
    };

    res.json(comment);
  } catch (error) {
    console.error("Error fetching comment:", error);
    res.status(500).json({ error: "Failed to fetch comment" });
  }
});

/**
 * @route   GET /api/comments/product/:productId
 * @desc    Lấy bình luận theo sản phẩm
 * @access  Public
 */
router.get("/product/:productId", async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Kiểm tra sản phẩm tồn tại
    const [products] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Đếm tổng số bình luận
    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM comment WHERE product_id = ?",
      [productId]
    );

    const totalComments = countResult[0].total;
    const totalPages = Math.ceil(totalComments / limit);

    // Lấy thông tin tổng hợp đánh giá
    const [ratingStats] = await db.query(
      `
      SELECT 
  AVG(comment_rating) as average_rating,
  COUNT(*) as total_ratings,
  SUM(CASE WHEN comment_rating = 5 THEN 1 ELSE 0 END) as five_star,
  SUM(CASE WHEN comment_rating = 4 THEN 1 ELSE 0 END) as four_star,
  SUM(CASE WHEN comment_rating = 3 THEN 1 ELSE 0 END) as three_star,
  SUM(CASE WHEN comment_rating = 2 THEN 1 ELSE 0 END) as two_star,
  SUM(CASE WHEN comment_rating = 1 THEN 1 ELSE 0 END) as one_star
FROM comment
WHERE product_id = ?

    `,
      [productId]
    );

    // Lấy danh sách bình luận - removed users table join
    const [comments] = await db.query(
      `
   SELECT 
  c.comment_id,
  c.comment_description,
  c.comment_rating,
  c.created_at,
  u.user_id,
  u.user_name,
  u.user_image
FROM comment c
JOIN user u ON c.user_id = u.user_id
WHERE c.product_id = ?
ORDER BY c.created_at DESC
LIMIT ?, ?

    `,
      [productId, offset, limit]
    );

    // Add placeholders for user data
    const commentsWithPlaceholder = comments.map((comment) => ({
      ...comment,
      user_name: `User ${comment.user_id}`,
      user_avatar: null,
    }));

    res.json({
      product_id: productId,
      stats: {
        average_rating: ratingStats[0].average_rating || 0,
        total_ratings: ratingStats[0].total_ratings || 0,
        rating_breakdown: {
          five_star: ratingStats[0].five_star || 0,
          four_star: ratingStats[0].four_star || 0,
          three_star: ratingStats[0].three_star || 0,
          two_star: ratingStats[0].two_star || 0,
          one_star: ratingStats[0].one_star || 0,
        },
      },
      comments: commentsWithPlaceholder,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching product comments:", error);
    res.status(500).json({ error: "Failed to fetch product comments" });
  }
});

/**
 * @route   GET /api/comments/user/:userId
 * @desc    Lấy bình luận theo người dùng
 * @access  Private
 */
router.get("/user/:userId", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized access to user comments" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Đếm tổng số bình luận
    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM comment WHERE user_id = ?",
      [userId]
    );

    const totalComments = countResult[0].total;
    const totalPages = Math.ceil(totalComments / limit);

    // Lấy danh sách bình luận
    const [comments] = await db.query(
      `
      SELECT 
        c.*,
        p.name as product_name,
        p.slug as product_slug,
        p.thumbnail as product_thumbnail
      FROM comment c
      LEFT JOIN product p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
      LIMIT ?, ?
    `,
      [userId, offset, limit]
    );

    res.json({
      user_id: userId,
      comments,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.status(500).json({ error: "Failed to fetch user comments" });
  }
});

/**
 * @route   POST /api/comments
 * @desc    Tạo bình luận/đánh giá mới
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { product_id, content, rating, images } = req.body;
    const user_id = req.user.id;

    // Kiểm tra các trường bắt buộc
    if (!product_id || !content) {
      return res
        .status(400)
        .json({ error: "Product ID and content are required" });
    }

    // Kiểm tra giá trị đánh giá hợp lệ
    if (
      rating &&
      (isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
    ) {
      return res
        .status(400)
        .json({ error: "Rating must be a number between 1 and 5" });
    }

    // Kiểm tra sản phẩm tồn tại
    const [products] = await db.query("SELECT id FROM product WHERE id = ?", [
      product_id,
    ]);

    if (products.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Kiểm tra xem người dùng đã mua sản phẩm này chưa (nếu cần)
    if (req.query.verify_purchase === "true") {
      const [purchases] = await db.query(
        `
        SELECT COUNT(*) as count
        FROM order_item oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.user_id = ? AND oi.product_id = ? AND o.status_id IN (
          SELECT id FROM order_status WHERE name IN ('completed', 'delivered')
        )
      `,
        [user_id, product_id]
      );

      if (purchases[0].count === 0) {
        return res
          .status(400)
          .json({ error: "You can only review products you have purchased" });
      }
    }

    // Kiểm tra xem người dùng đã bình luận sản phẩm này chưa (nếu chỉ cho phép một đánh giá/người dùng)
    if (req.query.allow_multiple === "false") {
      const [existingComments] = await db.query(
        "SELECT id FROM comment WHERE user_id = ? AND product_id = ?",
        [user_id, product_id]
      );

      if (existingComments.length > 0) {
        return res
          .status(400)
          .json({ error: "You have already reviewed this product" });
      }
    }

    // Lưu bình luận vào database
    const [result] = await db.query(
      `
      INSERT INTO comment (
        user_id, 
        product_id, 
        content, 
        rating, 
        images,
        created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `,
      [
        user_id,
        product_id,
        content,
        rating || null,
        images ? JSON.stringify(images) : null,
      ]
    );

    // After insert, get the new comment without users table join
    const [newComment] = await db.query(
      `
      SELECT c.*
      FROM comment c
      WHERE c.id = ?
    `,
      [result.insertId]
    );

    // Add placeholder for user data
    const commentWithPlaceholder = {
      ...newComment[0],
      user_name: `User ${req.user.id}`,
      user_avatar: null,
    };

    // Cập nhật số sao đánh giá trung bình của sản phẩm
    await db.query(
      `
      UPDATE product 
      SET 
        rating_count = (SELECT COUNT(*) FROM comment WHERE product_id = ? AND rating IS NOT NULL),
        rating_average = (SELECT AVG(rating) FROM comment WHERE product_id = ? AND rating IS NOT NULL)
      WHERE id = ?
    `,
      [product_id, product_id, product_id]
    );

    res.status(201).json({
      message: "Comment created successfully",
      comment: commentWithPlaceholder,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Cập nhật bình luận
 * @access  Private
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }

    const { content, rating, images } = req.body;

    // Kiểm tra bình luận tồn tại
    const [comments] = await db.query("SELECT * FROM comment WHERE id = ?", [
      id,
    ]);

    if (comments.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const comment = comments[0];
    const product_id = comment.product_id;

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== comment.user_id) {
      return res
        .status(403)
        .json({ error: "You can only update your own comments" });
    }

    // Kiểm tra giá trị đánh giá hợp lệ
    if (
      rating &&
      (isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
    ) {
      return res
        .status(400)
        .json({ error: "Rating must be a number between 1 and 5" });
    }

    // Cập nhật bình luận
    const updates = [];
    const values = [];

    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }

    if (rating !== undefined) {
      updates.push("rating = ?");
      values.push(rating);
    }

    if (images !== undefined) {
      updates.push("images = ?");
      values.push(images ? JSON.stringify(images) : null);
    }

    updates.push("updated_at = NOW()");

    if (updates.length === 1 && updates[0] === "updated_at = NOW()") {
      return res.status(400).json({ error: "No update data provided" });
    }

    values.push(id);

    await db.query(
      `UPDATE comment SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // After update, get the updated comment without users table join
    const [updatedComment] = await db.query(
      `
      SELECT c.*
      FROM comment c
      WHERE c.id = ?
    `,
      [id]
    );

    // Add placeholder for user data
    const commentWithPlaceholder = {
      ...updatedComment[0],
      user_name: `User ${updatedComment[0].user_id}`,
      user_avatar: null,
    };

    // Cập nhật số sao đánh giá trung bình của sản phẩm
    await db.query(
      `
      UPDATE product 
      SET 
        rating_count = (SELECT COUNT(*) FROM comment WHERE product_id = ? AND rating IS NOT NULL),
        rating_average = (SELECT AVG(rating) FROM comment WHERE product_id = ? AND rating IS NOT NULL)
      WHERE id = ?
    `,
      [product_id, product_id, product_id]
    );

    res.json({
      message: "Comment updated successfully",
      comment: commentWithPlaceholder,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

/**
 * @route   DELETE /api/comments/:id
 * @desc    Xóa bình luận
 * @access  Private
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid comment ID" });
    }

    // Kiểm tra bình luận tồn tại
    const [comments] = await db.query("SELECT * FROM comment WHERE id = ?", [
      id,
    ]);

    if (comments.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const comment = comments[0];
    const product_id = comment.product_id;

    // Kiểm tra quyền truy cập
    if (!req.user.isAdmin && req.user.id !== comment.user_id) {
      return res
        .status(403)
        .json({ error: "You can only delete your own comments" });
    }

    // Xóa bình luận
    await db.query("DELETE FROM comment WHERE id = ?", [id]);

    // Cập nhật số sao đánh giá trung bình của sản phẩm
    await db.query(
      `
      UPDATE product 
      SET 
        rating_count = (SELECT COUNT(*) FROM comment WHERE product_id = ? AND rating IS NOT NULL),
        rating_average = (SELECT AVG(rating) FROM comment WHERE product_id = ? AND rating IS NOT NULL)
      WHERE id = ?
    `,
      [product_id, product_id, product_id]
    );

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

module.exports = router;
