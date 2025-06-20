const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

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
// verifyToken, isAdmin;
router.post("/", async (req, res) => {
  try {
    const { name, image, banner, slug, status, priority } = req.body;

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
      "INSERT INTO category (category_name, category_image, category_banner, category_status, category_priority, created_at, slug) VALUES (?, ?, ?, ?, ?, NOW(), ?)",
      [name, image || null, banner || null, typeof status === "number" ? status : 1, typeof priority === "number" ? priority : 0, slug]
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
// verifyToken, isAdmin,
router.put("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const { name, image, banner, priority, status } = req.body;

    // 1. Kiểm tra danh mục tồn tại
    const [oldData] = await db.query(
      "SELECT category_id, category_image, category_banner FROM category WHERE slug = ?",
      [slug]
    );
    if (!oldData.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = oldData[0].category_id;
    const oldImage = oldData[0].category_image;
    const oldBanner = oldData[0].category_banner;

    // 2. Kiểm tra tên mới có trùng không
    if (name) {
      const [duplicateName] = await db.query(
        "SELECT category_id FROM category WHERE category_name = ? AND slug != ?",
        [name, slug]
      );
      if (duplicateName.length > 0) {
        return res.status(400).json({ error: "Category name already exists" });
      }
    }

    // 3. Hàm xóa ảnh cũ nếu có
    const deleteFromCloudinary = async (url) => {
      if (!url) return;
      const publicId = url
        .split("/")
        .slice(7)
        .join("/")
        .replace(/\.(jpg|jpeg|png|webp)$/i, "");
      await cloudinary.uploader.destroy(publicId);
    };

    if (image && image !== oldImage) {
      await deleteFromCloudinary(oldImage);
    }

    if (banner && banner !== oldBanner) {
      await deleteFromCloudinary(oldBanner);
    }

    // 4. Cập nhật
    await db.query(
      `
      UPDATE category 
      SET 
        category_name = COALESCE(?, category_name),
        category_image = COALESCE(?, category_image),
        category_banner = COALESCE(?, category_banner),
        category_priority = COALESCE(?, category_priority),
        category_status = COALESCE(?, category_status),
        updated_at = NOW()
      WHERE slug = ?
      `,
      [name || null, image || null, banner || null, priority || 0, status ?? 1, slug]
    );

    const [updatedCategory] = await db.query("SELECT * FROM category WHERE slug = ?", [slug]);

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
// verifyToken, isAdmin,
router.delete("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    // Kiểm tra danh mục tồn tại
    const [categoryData] = await db.query(
      "SELECT category_id, category_image, category_banner FROM category WHERE slug = ?",
      [slug]
    );

    if (!categoryData.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = categoryData[0].category_id;
    console.log("Category ID:", categoryId);

    const { category_image, category_banner } = categoryData[0];

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

    const deleteFromCloudinary = async (url) => {
      if (!url) return;
      const publicId = url
        .split("/")
        .slice(7)
        .join("/")
        .replace(/\.(jpg|jpeg|png|webp)$/i, "");
      await cloudinary.uploader.destroy(publicId);
    };

    deleteFromCloudinary(category_image);
    deleteFromCloudinary(category_banner);

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
          JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id AND col.color_priority = 1
          LIMIT 1
        ) AS price,
        (
          SELECT vp2.variant_product_price_sale
          FROM variant_product vp2
          JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id AND col.color_priority = 1
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
      } catch { }

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
