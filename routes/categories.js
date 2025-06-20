const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");





/**
 * @route   GET /filter/categories
 * @desc    Lấy danh sách danh mục
 * @access  Public
 */
router.get("/filter/", async (req, res) => {
  const [rows] = await db.query(`
    SELECT category_id, category_name, slug, category_icon
    FROM category
    WHERE category_status = 1
    ORDER BY category_priority ASC
  `);
  res.json(rows);
});
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
    res
      .status(500)
      .json({ error: "Failed to fetch categories", details: error.message });
  }
});

/**
 * @route   GET /api/categories/:slug
 * @desc    Lấy thông tin một danh mục theo slug
 * @access  Public
 */
router.get("/:slug", async (req, res) => {
  let slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });
  try {
    const sql = `
      SELECT 
        c.*,
        c.slug,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      WHERE c.slug = ?
    `;
    const [category] = await db.query(sql, [slug]);

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
    const { name, description, image, slug } = req.body;

    if (!name || !slug) {
      return res
        .status(400)
        .json({ error: "Category name and slug are required" });
    }

    // Kiểm tra tên danh mục đã tồn tại chưa
    const [existingCategories] = await db.query(
      "SELECT category_id FROM category WHERE slug = ?",
      [slug]
    );

    if (existingCategories.length > 0) {
      return res.status(400).json({ error: "Category slug already exists" });
    }

    // Tạo danh mục mới
    await db.query(
      "INSERT INTO category (category_name, category_image, category_status, created_at, slug) VALUES (?, ?, ?, NOW(), ?)",
      [name, image || null, 1, slug]
    );

    // Lấy thông tin danh mục vừa tạo
    const [newCategory] = await db.query(
      "SELECT * FROM category WHERE slug = ?",
      [slug]
    );

    res.status(201).json({
      message: "Category created successfully",
      category: newCategory[0],
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
router.put("/:slug", verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const { name, description, image } = req.body;

    // Kiểm tra danh mục tồn tại
    const [existingCategory] = await db.query(
      "SELECT category_id FROM category WHERE slug = ?",
      [slug]
    );

    if (!existingCategory.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Kiểm tra tên mới có trùng với danh mục khác không
    if (name) {
      const [duplicateName] = await db.query(
        "SELECT category_id FROM category WHERE category_name = ? AND slug != ?",
        [name, slug]
      );

      if (duplicateName.length > 0) {
        return res.status(400).json({ error: "Category name already exists" });
      }
    }

    // Cập nhật thông tin danh mục
    await db.query(
      `
      UPDATE category 
      SET 
        category_name = COALESCE(?, category_name),
        category_image = COALESCE(?, category_image),
        updated_at = NOW()
      WHERE slug = ?
    `,
      [name || null, image || null, slug]
    );

    // Lấy thông tin danh mục đã cập nhật
    const [updatedCategory] = await db.query(
      "SELECT * FROM category WHERE slug = ?",
      [slug]
    );

    res.json({
      message: "Category updated successfully",
      category: updatedCategory[0],
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
router.delete("/:slug", verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    // Kiểm tra danh mục tồn tại
    const [existingCategory] = await db.query(
      "SELECT category_id FROM category WHERE slug = ?",
      [slug]
    );

    if (!existingCategory.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = existingCategory[0].category_id;
    console.log("Category ID:", categoryId);

    // Kiểm tra xem danh mục có sản phẩm nào không
    const [products] = await db.query(
      "SELECT product_id FROM product WHERE category_id = ? ",
      [categoryId]
    );

    if (products.length > 0) {
      const productIds = products.map((p) => p.product_id).join(", ");
      return res.status(400).json({
        error:
          "Cannot delete category with products. Remove or reassign products first.",
        totalProducts: products.length,
        productIds: productIds,
      });
    }

    // Xóa danh mục
    await db.query("DELETE FROM category WHERE slug = ?", [slug]);

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
router.get("/:slug/products", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    const allowedSortFields = ["created_at", "updated_at", "product_name"];
    const sort_by = allowedSortFields.includes(req.query.sort_by)
      ? req.query.sort_by
      : "created_at";

    const sort_order =
      req.query.sort_order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Kiểm tra danh mục
    const [category] = await db.query(
      "SELECT category_id, category_name FROM category WHERE slug = ?",
      [slug]
    );

    if (!category.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = category[0].category_id;

    // Đếm tổng sản phẩm
    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM product WHERE category_id = ?",
      [categoryId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Query sản phẩm
    const [products] = await db.query(
      `
       SELECT 
  p.product_id AS id,
  p.product_name AS name,
  p.product_slug AS slug,
  p.product_image AS image,
  p.category_id,
  c.category_id,
  c.category_name,
  p.created_at,
  p.updated_at,

  
 (
  SELECT vp2.variant_product_price
  FROM variant_product vp2
  WHERE vp2.product_id = p.product_id
  ORDER BY vp2.variant_id ASC
  LIMIT 1
) AS price,
(
  SELECT vp2.variant_product_price_sale
  FROM variant_product vp2
  WHERE vp2.product_id = p.product_id
  ORDER BY vp2.variant_id ASC
  LIMIT 1
) AS price_sale,


  JSON_ARRAYAGG(DISTINCT col.color_hex) AS color_hex

        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        WHERE p.category_id = ?
        GROUP BY p.product_id 
        ORDER BY p.${sort_by} ${sort_order}
        LIMIT ?, ?
    `,
      [categoryId, offset, limit]
    );

    const transformedProducts = products.map((product) => {
      let colorHex = [];
      try {
        colorHex = JSON.parse(product.color_hex || "[]");
      } catch {}

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        price: product.price ?? "0.00",
        price_sale: product.price_sale ?? "0.00",
        color_hex: colorHex,
      };
    });

    res.json({
      category: category[0],
      products: transformedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});




module.exports = router;
