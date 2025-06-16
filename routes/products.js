const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

const LIMIT_PER_PAGE = 8;

/**
 * @route   GET /api/products
 * @desc    Lấy danh sách sản phẩm với phân trang, lọc và sắp xếp
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT 
        p.product_id AS id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS image,
        p.category_id,
        c.category_name,
        p.created_at,
        p.updated_at,

        -- Giá mặc định từ màu có priority = 1
        (
          SELECT col.variant_product_price
          FROM variant_product vp2
          JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id AND col.color_priority = 1
          LIMIT 1
        ) AS price,

        (
          SELECT col.variant_product_price_sale
          FROM variant_product vp2
          JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id AND col.color_priority = 1
          LIMIT 1
        ) AS price_sale,

        -- Mảng màu hex
        JSON_ARRAYAGG(DISTINCT col.color_hex) AS color_hex

      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE p.product_status = 1
      GROUP BY p.product_id
      ORDER BY p.created_at DESC
    `;

    const [products] = await db.query(query);

    const result = products.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category_id: item.category_id,
      category_name: item.category_name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      price: item.price,
      price_sale: item.price_sale,
      color_hex: JSON.parse(item.color_hex),
    }));

    res.json({ products: result });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Lấy thông tin chi tiết một sản phẩm
 * @access  Public
 */

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  try {
    // 1. Lấy sản phẩm chính + tên danh mục
    const [productRows] = await db.query(
      `
      SELECT 
        p.*,
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_slug = ? AND p.product_status = 1
      `,
      [slug]
    );
    if (!productRows.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productRows[0];

    // 2. Lấy tất cả biến thể màu sắc (có cả color_priority)
    const [variants] = await db.query(
      `
     SELECT
  vp.variant_id,
  c.color_id,
  c.color_name,
  c.color_hex,
  c.color_priority,
  c.variant_product_price     AS price,
  c.variant_product_price_sale AS price_sale,
  c.variant_product_quantity  AS quantity,
  c.variant_product_slug      AS slug,
  c.variant_product_list_image AS list_image
FROM variant_product vp
JOIN color c ON vp.color_id = c.color_id
WHERE vp.product_id = ?
ORDER BY c.color_priority DESC
      `,
      [product.product_id]
    );

    // 3. Chọn biến thể mặc định: ưu tiên color_priority = 1
    let defaultVariant = variants.find((v) => v.color_priority === 1);
    if (!defaultVariant && variants.length > 0) {
      defaultVariant = variants[0];
    }

    // 4. Lấy sản phẩm liên quan
    const [relatedProducts] = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug
      FROM product p
      WHERE p.category_id = ? AND p.product_id != ? AND p.product_status = 1
      LIMIT 4
      `,
      [product.category_id, product.product_id]
    );

    // 5. Trả về response
    res.json({
      product: {
        id: product.product_id,
        name: product.product_name,
        description: product.product_description,
        slug: product.product_slug,
        sold: product.product_sold,
        view: product.product_view,
        rating: product.product_rating,
        materials: product.variant_materials,
        height: product.variant_height,
        width: product.variant_width,
        depth: product.variant_depth,
        seating_height: product.variant_seating_height,
        max_weight_load: product.variant_maximum_weight_load,
        status: product.product_status,
        sold: product.product_sold, // trường mới bạn thêm
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        // giá và ảnh mặc định theo variant ưu tiên
        // defaultPrice: defaultVariant?.price ?? null,
        // defaultPriceSale: defaultVariant?.price_sale ?? null,
        // defaultImage: defaultVariant?.list_image?.split(",")[0]?.trim() ?? null,
        // defaultSlug: defaultVariant?.slug ?? null,
        // // defaultColorId: defaultVariant?.color_id ?? null,
        // defaultColorName: defaultVariant?.color_name ?? null,
        // defaultColorHex: defaultVariant?.color_hex ?? null,
        // defaultQuantity: defaultVariant?.quantity ?? null,
      },
      variants: variants.map((v) => ({
        variantId: v.variant_id,
        colorId: v.color_id,
        colorName: v.color_name,
        colorHex: v.color_hex,
        colorPriority: v.color_priority,
        price: v.price,
        priceSale: v.price_sale,
        quantity: v.quantity,
        slug: v.slug,
        listImage: v.list_image,
      })),
      related_products: relatedProducts.map((rp) => ({
        id: rp.product_id,
        name: rp.product_name,
        slug: rp.product_slug,
      })),
    });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

/**
 * @route   POST /api/products
 * @desc    Tạo sản phẩm mới
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category_id,
      stock,
      sku,
      image,
      dimensions,
      material,
      variants,
      room_ids,
    } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!name || !price || !category_id) {
      return res
        .status(400)
        .json({ error: "Name, price and category_id are required" });
    }

    // Tạo sản phẩm mới
    const [result] = await db.query(
      `
      INSERT INTO product (
        product_name, product_description, product_price, category_id, product_stock, product_sku, 
        product_image, product_dimensions, product_material, product_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        name,
        description || null,
        price,
        category_id,
        stock || 0,
        sku || null,
        image || null,
        dimensions || null,
        material || null,
        1,
      ]
    );

    const productId = result.insertId;

    // Thêm các biến thể nếu có
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantValues = variants.map((v) => [
        productId,
        v.color || null,
        v.size || null,
        v.price || price,
        v.sku || null,
        v.image || null,
        v.stock || 0,
      ]);

      const variantPlaceholders = variants
        .map(() => "(?, ?, ?, ?, ?, ?, ?)")
        .join(", ");

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${variantPlaceholders}
      `,
        variantValues.flat()
      );
    }

    // Thêm liên kết với các phòng nếu có
    if (room_ids && Array.isArray(room_ids) && room_ids.length > 0) {
      const roomValues = room_ids.map((roomId) => [productId, roomId]);

      const roomPlaceholders = room_ids.map(() => "(?, ?)").join(", ");

      await db.query(
        `
        INSERT INTO room_product (product_id, room_id) 
        VALUES ${roomPlaceholders}
      `,
        roomValues.flat()
      );
    }

    // Lấy thông tin sản phẩm vừa tạo
    const [createdProduct] = await db.query(
      `
      SELECT * FROM product WHERE product_id = ?
    `,
      [productId]
    );

    res.status(201).json({
      message: "Product created successfully",
      product: createdProduct[0],
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Cập nhật thông tin sản phẩm
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });

  try {
    const {
      name,
      description,
      price,
      category_id,
      stock,
      sku,
      image,
      dimensions,
      material,
      variants,
      room_ids,
    } = req.body;

    // Kiểm tra sản phẩm tồn tại
    const [existingProduct] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [id]
    );

    if (!existingProduct.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Cập nhật thông tin sản phẩm
    await db.query(
      `
      UPDATE product 
      SET 
        product_name = COALESCE(?, product_name),
        product_description = COALESCE(?, product_description),
        product_price = COALESCE(?, product_price),
        category_id = COALESCE(?, category_id),
        product_stock = COALESCE(?, product_stock),
        product_sku = COALESCE(?, product_sku),
        product_image = COALESCE(?, product_image),
        product_dimensions = COALESCE(?, product_dimensions),
        product_material = COALESCE(?, product_material),
        product_status = COALESCE(?, product_status),
        updated_at = NOW()
      WHERE product_id = ?
    `,
      [
        name || null,
        description || null,
        price || null,
        category_id || null,
        stock || null,
        sku || null,
        image || null,
        dimensions || null,
        material || null,
        1,
        id,
      ]
    );

    // Cập nhật biến thể nếu có
    if (variants && Array.isArray(variants) && variants.length > 0) {
      // Xóa biến thể cũ
      await db.query("DELETE FROM variant_product WHERE product_id = ?", [id]);

      // Thêm biến thể mới
      const variantValues = variants.map((v) => [
        id,
        v.color || null,
        v.size || null,
        v.price || price,
        v.sku || null,
        v.image || null,
        v.stock || 0,
      ]);

      const variantPlaceholders = variants
        .map(() => "(?, ?, ?, ?, ?, ?, ?)")
        .join(", ");

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${variantPlaceholders}
      `,
        variantValues.flat()
      );
    }

    // Cập nhật liên kết phòng nếu có
    if (room_ids && Array.isArray(room_ids)) {
      // Xóa liên kết cũ
      await db.query("DELETE FROM room_product WHERE product_id = ?", [id]);

      // Thêm liên kết mới nếu có
      if (room_ids.length > 0) {
        const roomValues = room_ids.map((roomId) => [id, roomId]);
        const roomPlaceholders = room_ids.map(() => "(?, ?)").join(", ");

        await db.query(
          `
          INSERT INTO room_product (product_id, room_id) 
          VALUES ${roomPlaceholders}
        `,
          roomValues.flat()
        );
      }
    }

    // Lấy thông tin sản phẩm đã cập nhật
    const [updatedProduct] = await db.query(
      `
      SELECT * FROM product WHERE product_id = ?
    `,
      [id]
    );

    res.json({
      message: "Product updated successfully",
      product: updatedProduct[0],
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Xóa sản phẩm
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID phải là số" });

  try {
    // Kiểm tra sản phẩm tồn tại
    const [existingProduct] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [id]
    );

    if (!existingProduct.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Xóa các bản ghi liên quan
    await db.query("DELETE FROM variant_product WHERE product_id = ?", [id]);
    await db.query("DELETE FROM room_product WHERE product_id = ?", [id]);
    await db.query("DELETE FROM wishlist WHERE product_id = ?", [id]);
    await db.query("DELETE FROM comment WHERE product_id = ?", [id]);

    // Kiểm tra sản phẩm có trong order_items không
    const [orderItems] = await db.query(
      "SELECT id FROM order_items WHERE product_id = ? LIMIT 1",
      [id]
    );

    if (orderItems.length > 0) {
      // Nếu có trong order, đánh dấu là đã xóa nhưng không xóa thực sự
      await db.query(
        "UPDATE product SET product_status = 0 WHERE product_id = ?",
        [id]
      );
      return res.json({ message: "Product marked as deleted" });
    }

    // Xóa sản phẩm
    await db.query("DELETE FROM product WHERE product_id = ?", [id]);

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

/**
 * @route   GET /api/products/featured
 * @desc    Lấy danh sách sản phẩm nổi bật
 * @access  Public
 */
router.get("/featured/list", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const [products] = await db.query(
      `
      SELECT 
        p.*, 
        l.category_name,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM product p
      LEFT JOIN category l ON p.category_id = l.category_id
      WHERE p.product_status = 1 AND p.product_priority = 1
      ORDER BY p.created_at DESC
      LIMIT ?
    `,
      [limit]
    );

    res.json(products);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

/**
 * @route   GET /api/products/by-category/:categoryId
 * @desc    Lấy sản phẩm theo danh mục
 * @access  Public
 */
router.get("/by-category/:categoryId", async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  if (isNaN(categoryId))
    return res.status(400).json({ message: "Category ID phải là số" });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || LIMIT_PER_PAGE;
    const offset = (page - 1) * limit;

    // Đếm tổng số sản phẩm trong danh mục
    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM product WHERE category_id = ? AND product_status = 1",
      [categoryId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Lấy sản phẩm theo danh mục với phân trang
    const [products] = await db.query(
      `
      SELECT 
        p.*,
        c.category_name as category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.category_id = ? AND p.product_status = 1
      ORDER BY p.created_at DESC
      LIMIT ?, ?
    `,
      [categoryId, offset, limit]
    );

    // Transform products
    const transformedProducts = products.map((product) => {
      return {
        id: product.product_id,
        name: product.product_name,
        description: product.product_description,
        price: product.product_price,
        price_sale: product.product_price_sale,
        image: product.product_image,
        list_image: product.product_list_image,
        slug: product.product_slug,
        category_id: product.category_id,
        category_name: product.category_name,
        status: product.product_status,
        priority: product.product_priority,
        view: product.product_view,
        rating: product.product_rating,
        created_at: product.created_at,
        updated_at: product.updated_at,
      };
    });

    res.json({
      products: transformedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});

module.exports = router;
