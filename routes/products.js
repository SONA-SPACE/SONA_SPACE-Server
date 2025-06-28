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
router.get("/", verifyToken, async (req, res) => {
  try {
    // 1. Lấy tham số page và limit từ query, mặc định là 1 và 8
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    // 2. Lấy các tham số lọc từ query
    const category = req.query.category;
    const room = req.query.room;
    const price = req.query.price;
    const color = req.query.color;
    const sort = req.query.sort;

    // 3. Xây dựng câu query WHERE dựa trên các điều kiện lọc
    let whereConditions = ['p.product_status = 1'];
    let params = [];

    if (category) {
      whereConditions.push('c.category_name = ?');
      params.push(category);
    }

    if (room) {
      whereConditions.push('EXISTS (SELECT 1 FROM room_product rp JOIN room r ON rp.room_id = r.room_id WHERE rp.product_id = p.product_id AND r.room_name = ?)');
      params.push(room);
    }

    if (price) {
      switch (price) {
        case 'Dưới 10 triệu':
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) < 10000000
          `);
          break;
        case '10 - 30 triệu':
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) BETWEEN 10000000 AND 30000000
          `);
          break;
        case 'Trên 30 triệu':
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) > 30000000
          `);
          break;
      }
    }

    if (color) {
      whereConditions.push('col.color_name = ?');
      params.push(color);
    }

    // 4. Xây dựng câu ORDER BY dựa trên tham số sort
    let orderBy = 'p.created_at DESC';
    if (sort) {
      switch (sort) {
        case 'Giá tăng dần':
          orderBy = `
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) ASC
          `;
          break;
        case 'Giá giảm dần':
          orderBy = `
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) DESC
          `;
          break;
        case 'Mới nhất':
          orderBy = 'p.created_at DESC';
          break;
        case 'Giảm giá':
          orderBy = `
            (SELECT 
              MAX(
                CASE 
                  WHEN vp2.variant_product_price_sale > 0 
                  THEN ((vp2.variant_product_price - vp2.variant_product_price_sale) / vp2.variant_product_price * 100)
                  ELSE 0 
                END
              ) 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) DESC
          `;
          break;
      }
    }

    // 5. Truy vấn tổng số sản phẩm với điều kiện lọc
    const [[{ totalProducts }]] = await db.query(`
      SELECT COUNT(DISTINCT p.product_id) AS totalProducts
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE ${whereConditions.join(' AND ')}
    `, params);

    // 6. Truy vấn sản phẩm có phân trang và lọc
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
    (
      SELECT MIN(vp2.variant_product_price)
      FROM variant_product vp2
      WHERE vp2.product_id = p.product_id
    ) AS price,
    (
      SELECT MIN(vp2.variant_product_price_sale)
      FROM variant_product vp2
      WHERE vp2.product_id = p.product_id AND vp2.variant_product_price_sale > 0
    ) AS price_sale,
    JSON_ARRAYAGG(DISTINCT col.color_hex) AS color_hex,

    (
      SELECT 
        CASE 
          WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
          ELSE MIN(vp2.variant_product_price)
        END 
      FROM variant_product vp2 
      WHERE vp2.product_id = p.product_id
    ) AS actual_price,

    (
      SELECT vp2.variant_id
      FROM variant_product vp2
      JOIN color c2 ON vp2.color_id = c2.color_id
      WHERE vp2.product_id = p.product_id
      ORDER BY c2.color_priority = 1 DESC, c2.color_priority ASC, vp2.variant_id ASC
      LIMIT 1
    ) AS variant_id,

    (
  SELECT EXISTS (
    SELECT 1
    FROM wishlist w
    WHERE w.variant_id = (
      SELECT vp2.variant_id
      FROM variant_product vp2
      JOIN color c2 ON vp2.color_id = c2.color_id
      WHERE vp2.product_id = p.product_id
      ORDER BY c2.color_priority = 1 DESC, c2.color_priority ASC, vp2.variant_id ASC
      LIMIT 1
    )
    AND w.user_id = ?
    AND w.status = 1
  )
) AS isWishlist

  FROM product p
  LEFT JOIN category c ON p.category_id = c.category_id
  LEFT JOIN variant_product vp ON p.product_id = vp.product_id
  LEFT JOIN color col ON vp.color_id = col.color_id
  WHERE ${whereConditions.join(' AND ')}
  GROUP BY p.product_id
  ORDER BY ${orderBy}
  LIMIT ? OFFSET ?
`;

const userId = req.user?.id || 0;
const [products] = await db.query(query, [...params, userId, limit, offset]);


    // 7. Chuẩn hóa dữ liệu đầu ra
const result = products.map((item) => ({
  id: item.id,
  name: item.name,
  slug: item.slug,
  image: item.image,
  category_id: item.category_id,
  category_name: item.category_name,
  created_at: item.created_at,
  updated_at: item.updated_at,
  price: item.price ?? "0.00",
  price_sale: item.price_sale ?? "0.00",
  color_hex: JSON.parse(item.color_hex),
  variant_id: item.variant_id,
  isWishlist: item.isWishlist ===1
}));



    // 8. Phản hồi phân trang chuẩn REST
    res.json({
      products: result,
      pagination: {
        totalProducts,
        currentPage: page,
        productsPerPage: limit,
        totalPages: Math.ceil(totalProducts / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
router.get("/admin", async (req, res) => {
  try {
    const [products] = await db.query(`
      SELECT 
        p.product_id,
        p.product_name,
        p.product_image,
        c.category_name,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.product_priority,
        p.created_at,
        p.updated_at,
        p.product_slug,
        -- Lấy giá gốc của variant đầu tiên
        (
          SELECT vp.variant_product_price
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price,

        -- Lấy giá sale của variant đầu tiên nếu có
        (
          SELECT 
            CASE 
              WHEN vp.variant_product_price_sale > 0 THEN vp.variant_product_price_sale 
              ELSE NULL 
            END
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        -- Tổng số lượng từ tất cả variants
        (
          SELECT SUM(vp.variant_product_quantity)
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
        ) AS total_quantity,

        -- Số lượng đánh giá
        (
          SELECT COUNT(*) 
          FROM comment cm 
          WHERE cm.product_id = p.product_id
            AND cm.deleted_at IS NULL
        ) AS comment_count

      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      ORDER BY p.created_at DESC
    `);

    // Xử lý và format dữ liệu trước khi trả về
    const formattedProducts = products.map(product => ({
      ...product, 
      price: product.price || 0,
      price_sale: product.price_sale || null,  // Giữ null nếu không có giá sale
      total_quantity: product.total_quantity || 0,
      comment_count: product.comment_count || 0
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error("Error fetching admin products:", error);
    res.status(500).json({ error: "Failed to fetch admin product list" });
  }
});



/**
 * @route   GET /api/products/newest
 * @desc    Lấy danh sách sản phẩm mới nhất
 * @access  Public
 */
router.get("/newest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    // Lấy danh sách sản phẩm mới nhất
    const [products] = await db.query(
      `
      SELECT 
  p.product_id AS id,
  p.product_name AS name,
  p.product_slug AS slug,
  p.product_image AS image,
  p.category_id,
  cat.category_name,
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

  IFNULL(JSON_ARRAYAGG(DISTINCT col.color_hex), JSON_ARRAY()) AS color_hex,

  (
    SELECT COUNT(*) FROM comment WHERE product_id = p.product_id
  ) AS comment_count

FROM product p
LEFT JOIN category cat ON p.category_id = cat.category_id
LEFT JOIN variant_product vp ON p.product_id = vp.product_id
LEFT JOIN color col ON vp.color_id = col.color_id

WHERE p.product_status = 1
GROUP BY p.product_id
ORDER BY p.created_at DESC
LIMIT ?

    `,
      [limit] // Lấy nhiều hơn để tránh giới hạn dòng khi 1 sản phẩm có nhiều màu
    );

    // Nhóm theo `product_id` để trả về mỗi sản phẩm với tất cả các màu
    const result = products.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category_id: item.category_id,
      category_name: item.category_name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      price: item.price ?? "0.00",
      price_sale: item.price_sale ?? "0.00",
      color_hex: JSON.parse(item.color_hex || "[]"),
      comment_count: item.comment_count ?? 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching newest products:", error);
    res.status(500).json({ error: "Failed to fetch newest products" });
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
    // 1. Lấy thông tin sản phẩm chính
    const [productRows] = await db.query(
      `
      SELECT 
        p.*, c.category_name
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

    // 2. Lấy danh sách tất cả biến thể + màu sắc (để tìm biến thể mặc định và danh sách màu)
    const [variants] = await db.query(
      `
     SELECT
  vp.variant_id,
  vp.product_id,
  c.color_id,
  c.color_name,
  c.color_hex,
  c.color_priority,
  vp.variant_product_price AS price,
  vp.variant_product_price_sale AS price_sale,
  vp.variant_product_quantity AS quantity,
  vp.variant_product_slug AS slug,
  vp.variant_product_list_image AS list_image
FROM variant_product vp
JOIN color c ON vp.color_id = c.color_id
WHERE vp.product_id = ?
ORDER BY c.color_priority DESC

      `,
      [product.product_id]
    );

    // Chuẩn hóa variants trả về cho FE (đầy đủ các trường)
    const variantsFull = variants.map(v => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image ? v.list_image.split(',').map(img => img.trim().replace(/^['\"]+|['\"]+$/g, '')) : [],
    }));

    // 3. Tìm biến thể mặc định (ưu tiên color_priority = 1)
    let defaultVariant = variants.find((v) => v.color_priority === 1);
    if (!defaultVariant && variants.length > 0) {
      defaultVariant = variants[0];
    }

    // 4. Danh sách các màu sắc (nhẹ, không cần ảnh/giá)
    const colors = variants.map((v) => ({
      colorId: v.color_id,
      colorName: v.color_name,
      colorHex: v.color_hex,
      slug: v.slug,
    }));

    // 5. Lấy sản phẩm liên quan
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

    return res.json({
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
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        defaultPrice: defaultVariant?.price ?? null,
        defaultPriceSale: defaultVariant?.price_sale ?? null,
        defaultImages:
          defaultVariant?.list_image?.split(",").map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, "")) ?? [],
        main_image: product.product_image ? product.product_image.trim().replace(/^['\"]+|['\"]+$/g, "") : "",
        defaultSlug: defaultVariant?.slug ?? null,
        defaultColorName: defaultVariant?.color_name ?? null,
        defaultColorHex: defaultVariant?.color_hex ?? null,
        defaultQuantity: defaultVariant?.quantity ?? null,
        variants: variantsFull,
      },
      colors,
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
 * @route   DELETE /api/products/:slug
 * @desc    Xóa sản phẩm
 * @access  Private (Admin only)
 */
router.delete("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  try {
    // Lấy product_id từ slug
    const [existingProduct] = await db.query(
      "SELECT product_id FROM product WHERE product_slug = ?",
      [slug]
    );
    if (!existingProduct.length) {
      return res.status(404).json({ error: "Product not found" });
    }
    const id = existingProduct[0].product_id;

    // Lấy tất cả variant_id của sản phẩm
    const [variants] = await db.query(
      "SELECT variant_id FROM variant_product WHERE product_id = ?",
      [id]
    );
    const variantIds = variants.map(v => v.variant_id);
    let orderItems = [];
    if (variantIds.length > 0) {
      const [orderItemsResult] = await db.query(
        `SELECT order_item_id FROM order_items WHERE variant_id IN (${variantIds.map(() => '?').join(',')}) LIMIT 1`,
        variantIds
      );
      orderItems = orderItemsResult;
    }
    if (orderItems.length > 0) {
      // Nếu có trong order, đánh dấu là đã xóa nhưng không xóa thực sự
      await db.query(
        "UPDATE product SET product_status = 0 WHERE product_id = ?",
        [id]
      );
      return res.json({ message: "Product marked as deleted" });
    }

    // Xóa tất cả variant thuộc product này trước
    await db.query("DELETE FROM variant_product WHERE product_id = ?", [id]);
    // Xóa các bản ghi liên quan khác nếu cần
    await db.query("DELETE FROM room_product WHERE product_id = ?", [id]);
    if (variantIds.length > 0) {
      await db.query(
        `DELETE FROM wishlist WHERE variant_id IN (${variantIds.map(() => '?').join(',')})`,
        variantIds
      );
    }
    await db.query("DELETE FROM comment WHERE product_id = ?", [id]);

    // Xóa sản phẩm
    await db.query("DELETE FROM product WHERE product_id = ?", [id]);

    res.json({ message: "Product and all its variants deleted successfully" });
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
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count
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

/**
 * @route   POST /api/products/add
 * @desc    Tạo sản phẩm mới với biến thể
 * @access  Private (Admin only)
 */
router.post("/add", async (req, res) => {
  try {
    const {
      name,
      description,
      slug,
      category_id,
      status,
      materials,
      height,
      width,
      depth,
      seating_height,
      max_weight_load,
      main_image,
      room_ids,
      variants
    } = req.body;

    // Validate required fields
    if (!name || !slug || !category_id || !variants || !variants.length) {
      return res.status(400).json({
        error: "Missing required fields",
        required: "name, slug, category_id, variants"
      });
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Insert product
      const [productResult] = await connection.query(
        `INSERT INTO product (
          product_name,
          product_description,
          product_slug,
          category_id,
          product_status,
          variant_materials,
          variant_height,
          variant_width,
          variant_depth,
          variant_seating_height,
          variant_maximum_weight_load,
          product_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || null,
          slug,
          category_id,
          status || 1,
          materials || null,
          height || null,
          width || null,
          depth || null,
          seating_height || null,
          max_weight_load || null,
          main_image || null
        ]
      );

      const productId = productResult.insertId;

      // 2. Insert variants
      for (const variant of variants) {
        const {
          color_id,
          price,
          price_sale,
          quantity,
          list_image,
          variant_slug
        } = variant;

        if (!color_id || !price || !quantity || !list_image || !variant_slug) {
          throw new Error("Missing required variant fields");
        }

        await connection.query( 
          `INSERT INTO variant_product (
            product_id,
            color_id,
            variant_product_price,
            variant_product_price_sale,
            variant_product_quantity,
            variant_product_list_image,
            variant_product_slug
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            productId,
            color_id,
            price,
            price_sale || null,
            quantity,
            list_image.join(","),
            variant_slug
          ]
        );
      }

      // 3. Insert room associations if provided
      if (room_ids && room_ids.length > 0) {
        const roomValues = room_ids.map(roomId => [productId, roomId]);
        await connection.query(
          `INSERT INTO room_product (product_id, room_id) VALUES ?`,
          [roomValues]
        );
      }

      // Commit transaction
      await connection.commit();

      // Get the created product with variants
      const [product] = await db.query(
        `SELECT 
          p.*,
          c.category_name,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'variant_id', vp.variant_id,
              'color_id', vp.color_id,
              'color_name', col.color_name,
              'color_hex', col.color_hex,
              'price', vp.variant_product_price,
              'price_sale', vp.variant_product_price_sale,
              'quantity', vp.variant_product_quantity,
              'list_image', vp.variant_product_list_image,
              'slug', vp.variant_product_slug
            )
          ) as variants
        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        WHERE p.product_id = ?
        GROUP BY p.product_id`,
        [productId]
      );

      res.status(201).json({
        message: "Product created successfully",
        product: {
          ...product[0],
          variants: JSON.parse(product[0].variants)
        }
      });

    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      error: "Failed to create product",
      details: error.message
    });
  }
});

router.put("/admin/:slug", async (req, res) => {
  const { slug } = req.params;
  const {
    name,
    description,
    category_id,
    status,
    materials,
    height,
    width,
    depth,
    seating_height,
    max_weight_load,
    main_image,
    room_ids,
    variants
  } = req.body;

  // Validate
  if (!name || !slug || !category_id || !variants || !variants.length) {
    return res.status(400).json({
      error: "Missing required fields",
      required: "name, slug, category_id, variants"
    });
  }

  // Start transaction
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Lấy product_id từ slug
    const [productRows] = await connection.query(
      `SELECT product_id FROM product WHERE product_slug = ?`,
      [slug]
    );
    if (!productRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }
    const productId = productRows[0].product_id;

    // 2. Update product
    await connection.query(
      `UPDATE product SET
        product_name = ?,
        product_description = ?,
        category_id = ?,
        product_status = ?,
        variant_materials = ?,
        variant_height = ?,
        variant_width = ?,
        variant_depth = ?,
        variant_seating_height = ?,
        variant_maximum_weight_load = ?,
        product_image = ?
      WHERE product_id = ?`,
      [
        name,
        description || null,
        category_id,
        status || 1,
        materials || null,
        height || null,
        width || null,
        depth || null,
        seating_height || null,
        max_weight_load || null,
        main_image || null,
        productId
      ]
    );

    // 3. Xóa variants cũ
    await connection.query(
      `DELETE FROM variant_product WHERE product_id = ?`,
      [productId]
    );

    // 4. Thêm variants mới
    for (const variant of variants) {
      const {
        color_id,
        price,
        price_sale,
        quantity,
        list_image,
        variant_slug
      } = variant;

      if (!color_id || !price || !quantity || !list_image || !variant_slug) {
        throw new Error("Missing required variant fields");
      }

      await connection.query(
        `INSERT INTO variant_product (
          product_id,
          color_id,
          variant_product_price,
          variant_product_price_sale,
          variant_product_quantity,
          variant_product_list_image,
          variant_product_slug
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          color_id,
          price,
          price_sale || null,
          quantity,
          list_image.join(","),
          variant_slug
        ]
      );
    }

    // 5. Cập nhật liên kết phòng
    await connection.query(
      `DELETE FROM room_product WHERE product_id = ?`,
      [productId]
    );
    if (room_ids && room_ids.length > 0) {
      const roomValues = room_ids.map(roomId => [productId, roomId]);
      await connection.query(
        `INSERT INTO room_product (product_id, room_id) VALUES ?`,
        [roomValues]
      );
    }

    // Commit transaction
    await connection.commit();

    // Lấy lại sản phẩm đã cập nhật kèm variants
    const [product] = await db.query(
      `SELECT 
        p.*,
        c.category_name,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'variant_id', vp.variant_id,
            'color_id', vp.color_id,
            'color_name', col.color_name,
            'color_hex', col.color_hex,
            'price', vp.variant_product_price,
            'price_sale', vp.variant_product_price_sale,
            'quantity', vp.variant_product_quantity,
            'list_image', vp.variant_product_list_image,
            'slug', vp.variant_product_slug
          )
        ) as variants
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE p.product_id = ?
      GROUP BY p.product_id`,
      [productId]
    );

    res.json({
      message: "Product updated successfully",
      product: {
        ...product[0],
        variants: JSON.parse(product[0].variants)
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error updating product:", error);
    res.status(500).json({
      error: "Failed to update product",
      details: error.message
    });
  } finally {
    connection.release();
  }
});

    
router.get("/admin/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  try {
    // 1. Lấy thông tin sản phẩm chính
    const [productRows] = await db.query(
      `
      SELECT 
        p.*, c.category_name
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

    // 2. Lấy danh sách tất cả biến thể + màu sắc (để tìm biến thể mặc định và danh sách màu)
    const [variants] = await db.query(
      `
     SELECT
  vp.variant_id,
  vp.product_id,
  c.color_id,
  c.color_name,
  c.color_hex,
  c.color_priority,
  vp.variant_product_price AS price,
  vp.variant_product_price_sale AS price_sale,
  vp.variant_product_quantity AS quantity,
  vp.variant_product_slug AS slug,
  vp.variant_product_list_image AS list_image
FROM variant_product vp
JOIN color c ON vp.color_id = c.color_id
WHERE vp.product_id = ?
ORDER BY c.color_priority DESC

      `,
      [product.product_id]
    );

    // Chuẩn hóa variants trả về cho FE (đầy đủ các trường)
    const variantsFull = variants.map(v => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image ? v.list_image.split(',').map(img => img.trim().replace(/^['\"]+|['\"]+$/g, '')) : [],
    }));

    // 3. Tìm biến thể mặc định (ưu tiên color_priority = 1)
    let defaultVariant = variants.find((v) => v.color_priority === 1);
    if (!defaultVariant && variants.length > 0) {
      defaultVariant = variants[0];
    }

    // 4. Danh sách các màu sắc (nhẹ, không cần ảnh/giá)
    const colors = variants.map((v) => ({
      colorId: v.color_id,
      colorName: v.color_name,
      colorHex: v.color_hex,
      slug: v.slug,
    }));

    // 5. Lấy sản phẩm liên quan
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

    return res.json({
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
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        defaultPrice: defaultVariant?.price ?? null,
        defaultPriceSale: defaultVariant?.price_sale ?? null,
        defaultImages:
          defaultVariant?.list_image?.split(",").map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, "")) ?? [],
        main_image: product.product_image ? product.product_image.trim().replace(/^['\"]+|['\"]+$/g, "") : "",
        defaultSlug: defaultVariant?.slug ?? null,
        defaultColorName: defaultVariant?.color_name ?? null,
        defaultColorHex: defaultVariant?.color_hex ?? null,
        defaultQuantity: defaultVariant?.quantity ?? null,
        variants: variantsFull,
      },
      colors,
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

module.exports = router;
