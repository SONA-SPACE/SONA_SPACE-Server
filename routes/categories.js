const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục sản phẩm
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    console.log("Fetching categories...");
    
    const sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      ORDER BY c.category_name ASC
    `;
    
    console.log("SQL Query:", sql);
    
    try {
      const [categories] = await db.query(sql);
      console.log(`Found ${categories.length} categories`);
      
      return res.json(categories);
    } catch (dbError) {
      console.error("Database error:", dbError);
      console.error("SQL Error Code:", dbError.code);
      console.error("SQL Error Number:", dbError.errno);
      console.error("SQL Error Message:", dbError.message);
      console.error("SQL Error State:", dbError.sqlState);
      console.error("SQL Error Stack:", dbError.stack);
      
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories", details: error.message });
  }
});

/**
 * @route   GET /api/categories/:id
 * @desc    Lấy thông tin một danh mục theo ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  let id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  try {
    const sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      WHERE c.category_id = ?
    `;
    const [category] = await db.query(sql, [id]);
    
    if (!category || category.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    res.json(category[0]);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

/**
 * @route   POST /api/categories
 * @desc    Tạo danh mục mới
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, image } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }
    
    // Kiểm tra tên danh mục đã tồn tại chưa
    const [existingCategories] = await db.query(
      'SELECT category_id FROM category WHERE category_name = ?',
      [name]
    );
    
    if (existingCategories.length > 0) {
      return res.status(400).json({ error: "Category name already exists" });
    }
    
    // Tạo danh mục mới
    const [result] = await db.query(
      'INSERT INTO category (category_name, category_image, category_status, created_at) VALUES (?, ?, ?, NOW())',
      [name, image || null, 1]
    );
    
    const categoryId = result.insertId;
    
    // Lấy thông tin danh mục vừa tạo
    const [newCategory] = await db.query(
      'SELECT * FROM category WHERE category_id = ?',
      [categoryId]
    );
    
    res.status(201).json({
      message: "Category created successfully",
      category: newCategory[0]
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

/**
 * @route   PUT /api/categories/:id
 * @desc    Cập nhật thông tin danh mục
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  
  try {
    const { name, description, image } = req.body;
    
    // Kiểm tra danh mục tồn tại
    const [existingCategory] = await db.query(
      'SELECT category_id FROM category WHERE category_id = ?',
      [id]
    );
    
    if (!existingCategory.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    // Kiểm tra tên mới có trùng với danh mục khác không
    if (name) {
      const [duplicateName] = await db.query(
        'SELECT category_id FROM category WHERE category_name = ? AND category_id != ?',
        [name, id]
      );
      
      if (duplicateName.length > 0) {
        return res.status(400).json({ error: "Category name already exists" });
      }
    }
    
    // Cập nhật thông tin danh mục
    await db.query(`
      UPDATE category 
      SET 
        category_name = COALESCE(?, category_name),
        category_image = COALESCE(?, category_image),
        updated_at = NOW()
      WHERE category_id = ?
    `, [
      name || null, 
      image || null,
      id
    ]);
    
    // Lấy thông tin danh mục đã cập nhật
    const [updatedCategory] = await db.query(
      'SELECT * FROM category WHERE category_id = ?',
      [id]
    );
    
    res.json({
      message: "Category updated successfully",
      category: updatedCategory[0]
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

/**
 * @route   DELETE /api/categories/:id
 * @desc    Xóa danh mục
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  
  try {
    // Kiểm tra danh mục tồn tại
    const [existingCategory] = await db.query(
      'SELECT category_id FROM category WHERE category_id = ?',
      [id]
    );
    
    if (!existingCategory.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    // Kiểm tra xem danh mục có sản phẩm nào không
    const [products] = await db.query(
      'SELECT product_id FROM product WHERE category_id = ? LIMIT 1',
      [id]
    );
    
    if (products.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete category with products. Remove or reassign products first." 
      });
    }
    
    // Xóa danh mục
    await db.query('DELETE FROM category WHERE category_id = ?', [id]);
    
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

/**
 * @route   GET /api/categories/:id/products
 * @desc    Lấy tất cả sản phẩm thuộc một danh mục
 * @access  Public
 */
router.get("/:id/products", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;
    const sort_by = req.query.sort_by || 'created_at';
    const sort_order = req.query.sort_order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Kiểm tra danh mục tồn tại
    const [category] = await db.query(
      'SELECT category_id, category_name FROM category WHERE category_id = ?',
      [id]
    );
    
    if (!category.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    // Đếm tổng số sản phẩm trong danh mục
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM product WHERE category_id = ?',
      [id]
    );
    
    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);
    
    // Lấy sản phẩm theo danh mục
    const [products] = await db.query(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM product p
      WHERE p.category_id = ?
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ?, ?
    `, [id, offset, limit]);
    
    res.json({
      category: category[0],
      products,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});

module.exports = router;
