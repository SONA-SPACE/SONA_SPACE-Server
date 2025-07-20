console.log("comments.js router loaded.");
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
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // Kiểm tra sản phẩm tồn tại
    const [products] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [productId]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Tổng số bình luận
    const [[countResult]] = await db.query(
      "SELECT COUNT(*) as total FROM comment WHERE product_id = ?",
      [productId]
    );

    const totalComments = countResult.total;
    const totalPages = Math.ceil(totalComments / limit);

    // Lấy thông tin tổng hợp đánh giá
    const [[ratingStats]] = await db.query(
      `
        SELECT 
          ROUND(AVG(comment_rating), 1) as average_rating,
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

    // Lấy danh sách bình luận kèm user
    const [comments] = await db.query(
      `
        SELECT 
          c.comment_id,
          c.comment_title, 
          c.comment_description,
          c.comment_rating,
          c.created_at,
          u.user_id,
          c.comment_reaction, 
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

    // Trả về JSON
    res.json({
      product_id: productId,
      stats: {
        average_rating: ratingStats.average_rating || 0,
        total_ratings: ratingStats.total_ratings || 0,
        rating_breakdown: {
          five_star: ratingStats.five_star || 0,
          four_star: ratingStats.four_star || 0,
          three_star: ratingStats.three_star || 0,
          two_star: ratingStats.two_star || 0,
          one_star: ratingStats.one_star || 0,
        },
      },
      comments: comments.map((comment) => ({
        comment_id: comment.comment_id,
        user_id: comment.user_id,
        user_name: comment.user_name,
        user_image: comment.user_image,
        comment_title: comment.comment_title,
        comment_description: comment.comment_description,
        comment_rating: comment.comment_rating,
        comment_reaction: comment.comment_reaction,
        created_at: comment.created_at,
      })),
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
 * @desc    Tạo bình luận/đánh giá mới cho một order_item
 * @access  Private (Yêu cầu đăng nhập)
 */

router.post("/", verifyToken, async (req, res) => {
  const {
    order_item_id,
    comment_title,
    comment_description,
    comment_rating,
    // images, // Nếu bạn muốn thêm trường images, hãy bỏ comment và xử lý nó
  } = req.body;
  const user_id = req.user.id; // Lấy user_id từ token xác thực

  let connection; // Khai báo biến connection để dùng trong finally block

  try {
    // --- 1. Xác thực (Validation) dữ liệu đầu vào ---
    if (
      !order_item_id ||
      !comment_title ||
      !comment_description ||
      !comment_rating
    ) {
      return res.status(400).json({
        error:
          "Vui lòng cung cấp đầy đủ ID sản phẩm trong đơn hàng, tiêu đề, mô tả và điểm đánh giá.",
      });
    }

    if (
      isNaN(Number(comment_rating)) ||
      Number(comment_rating) < 1 ||
      Number(comment_rating) > 5
    ) {
      return res
        .status(400)
        .json({ error: "Điểm đánh giá phải là số từ 1 đến 5." });
    }

    connection = await db.getConnection(); // Lấy một kết nối từ pool
    await connection.beginTransaction(); // Bắt đầu transaction

    // --- 2. Kiểm tra điều kiện đánh giá (Quan trọng!) ---
    // Giữ nguyên alias ở đây để tránh lỗi ambiguous nếu có nhiều bảng có cột trùng tên
    // trong các JOIN phức tạp như thế này.
    const [orderItemInfo] = await connection.query(
      `
            SELECT
                order_items.order_item_id,
                order_items.comment_id AS existing_comment_id,
                orders.current_status AS order_status,
                orders.user_id AS order_user_id,
                variant_product.product_id AS linked_product_id,
                order_items.product_name
            FROM
                order_items
            JOIN
                orders ON order_items.order_id = orders.order_id
            JOIN
                variant_product ON order_items.variant_id = variant_product.variant_id
            WHERE
                order_items.order_item_id = ?
            LIMIT 1
            `,
      [order_item_id]
    );

    if (orderItemInfo.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: "Không tìm thấy sản phẩm trong đơn hàng này." });
    }

    const item = orderItemInfo[0];
    const product_id_from_item = item.linked_product_id;

    if (item.order_user_id !== user_id) {
      await connection.rollback();
      return res
        .status(403)
        .json({ error: "Bạn không có quyền đánh giá sản phẩm này." });
    }

    if (item.order_status !== "SUCCESS") {
      await connection.rollback();
      return res.status(400).json({
        error:
          "Đơn hàng chứa sản phẩm này chưa được giao thành công hoặc chưa hoàn tất.",
      });
    }

    if (item.existing_comment_id !== null) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: "Sản phẩm này đã được bạn đánh giá trước đó." });
    }

    // Giữ nguyên alias ở đây để tránh lỗi ambiguous vì có JOIN nhiều bảng và cột trùng tên.
    const [existingProductComment] = await connection.query(
      `
    SELECT comment.comment_id
    FROM comment
    JOIN order_items ON comment.order_item_id = order_items.order_item_id
    JOIN variant_product ON order_items.variant_id = variant_product.variant_id
    WHERE comment.user_id = ? AND variant_product.product_id = ?
    LIMIT 1
    `,
      [user_id, product_id_from_item]
    );

    if (existingProductComment.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error:
          "Bạn đã đánh giá sản phẩm này trước đó. Bạn chỉ có thể đánh giá một lần cho mỗi sản phẩm gốc.",
      });
    }

    // --- 3. Chèn đánh giá vào bảng `comment` (bỏ alias) ---
    const [commentResult] = await connection.query(
      `
            INSERT INTO comment (
                order_item_id,
                user_id,
                product_id,
                comment_title,
                comment_description,
                comment_rating,
                created_at,
                updated_at
               
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `,
      [
        order_item_id,
        user_id,
        product_id_from_item,
        comment_title,
        comment_description,
        comment_rating,
        // images ? JSON.stringify(images) : null, // nếu dùng
        // 0 // nếu dùng comment_reaction
      ]
    );

    const newCommentId = commentResult.insertId;

    // --- 4. Cập nhật `comment_id` vào bảng `order_items` (bỏ alias) ---
    await connection.query(
      `
            UPDATE order_items
            SET comment_id = ?
            WHERE order_item_id = ?
            `,
      [newCommentId, order_item_id]
    );

    await connection.commit(); // Commit transaction

    // --- 6. Trả về phản hồi (giữ lại alias để đơn giản hóa SELECT * và truy cập cột) ---
    // Hoặc bạn có thể liệt kê tất cả cột mà không dùng alias nếu muốn, nhưng sẽ dài hơn.
    const [createdComment] = await connection.query(
      `
        SELECT
            comment.*, -- Lấy tất cả cột từ bảng comment
            user.user_name,
            user.user_image,
            order_items.product_name AS reviewed_product_name,
            variant_product.product_id AS reviewed_product_id
        FROM comment
        JOIN user ON comment.user_id = user.user_id
        JOIN order_items ON comment.order_item_id = order_items.order_item_id
        JOIN variant_product ON order_items.variant_id = variant_product.variant_id
        WHERE comment.comment_id = ?
        `,
      [newCommentId]
    );
    res.status(201).json({
      message: "Đánh giá đã được tạo thành công!",
      comment: createdComment[0],
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Lỗi khi tạo bình luận:", error);
    res.status(500).json({
      error: "Có lỗi xảy ra khi tạo bình luận.",
      details: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
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
