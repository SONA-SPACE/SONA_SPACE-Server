const express = require("express");
const router = express.Router();
const db = require("../config/database");
const cloudinary = require("../config/cloudinary");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");
const LIMIT_PER_PAGE = 8;

/**
 * @route   GET /api/products
 * @desc    Lấy danh sách sản phẩm với phân trang, lọc và sắp xếp
 * @access  Public
 */
router.get("/all", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    const categorySlug = req.query.categorySlug;
    const roomSlug = req.query.roomSlug;
    const price = req.query.price;
    const color = req.query.color;
    const sort = req.query.sort;

    let whereConditions = ["p.product_status = 1"];
    let params = [];

    // Lọc theo categorySlug
    if (categorySlug) {
      whereConditions.push("c.slug = ?");
      params.push(categorySlug);
    }

    // Lọc theo roomSlug (bắt buộc nếu có)
    if (roomSlug) {
      whereConditions.push(`
          p.product_id IN (
            SELECT DISTINCT rp.product_id 
            FROM room_product rp 
            JOIN room r ON rp.room_id = r.room_id 
            WHERE r.slug = ?
          )
        `);
      params.push(roomSlug);
    }

    // Lọc theo giá
    if (price) {
      switch (price) {
        case "Dưới 10 triệu":
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
        case "10 - 30 triệu":
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
        case "Trên 30 triệu":
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

    // Lọc theo màu
    if (color) {
      whereConditions.push("col.color_name = ?");
      params.push(color);
    }

    // Sort
    let orderBy = "p.created_at DESC";
    if (sort) {
      switch (sort) {
        case "Giá tăng dần":
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
        case "Giá giảm dần":
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
        case "Mới nhất":
          orderBy = "p.created_at DESC";
          break;
        case "Giảm giá":
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

    // Đếm tổng sản phẩm
    const [[{ totalProducts }]] = await db.query(
      `
        SELECT COUNT(DISTINCT p.product_id) AS totalProducts
        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        WHERE ${whereConditions.join(" AND ")}
      `,
      params
    );

    // Lấy danh sách sản phẩm
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
          IFNULL(JSON_ARRAYAGG(DISTINCT r3.slug), JSON_ARRAY()) AS rooms,
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
        LEFT JOIN room_product rp3 ON p.product_id = rp3.product_id
        LEFT JOIN room r3 ON r3.room_id = rp3.room_id
        WHERE ${whereConditions.join(" AND ")}
        GROUP BY p.product_id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `;

    const finalParams = [userId, ...params, limit, offset];
    const [products] = await db.query(query, finalParams);

    res.json({
      products: products.map((item) => ({
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
        rooms: JSON.parse(item.rooms || "[]"),
        variant_id: item.variant_id,
        isWishlist: item.isWishlist === 1,
      })),
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

router.get("/", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
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
    let whereConditions = ["p.product_status = 1"];
    let params = [];

    if (category) {
      whereConditions.push("c.category_name = ?");
      params.push(category);
    }

    if (room) {
      whereConditions.push(
        "EXISTS (SELECT 1 FROM room_product rp JOIN room r ON rp.room_id = r.room_id WHERE rp.product_id = p.product_id AND r.room_name = ?)"
      );
      params.push(room);
    }

    if (price) {
      switch (price) {
        case "Dưới 10 triệu":
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
        case "10 - 30 triệu":
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
        case "Trên 30 triệu":
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
      whereConditions.push("col.color_name = ?");
      params.push(color);
    }

    // 4. Xây dựng câu ORDER BY dựa trên tham số sort
    let orderBy = "p.created_at DESC";
    if (sort) {
      switch (sort) {
        case "Giá tăng dần":
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
        case "Giá giảm dần":
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
        case "Mới nhất":
          orderBy = "p.created_at DESC";
          break;
        case "Giảm giá":
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
    const [[{ totalProducts }]] = await db.query(
      `
      SELECT COUNT(DISTINCT p.product_id) AS totalProducts
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE ${whereConditions.join(" AND ")}
    `,
      params
    );

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
  WHERE ${whereConditions.join(" AND ")}
  GROUP BY p.product_id
  ORDER BY ${orderBy}
  LIMIT ? OFFSET ?
`;

    const finalParams = [userId, ...params, limit, offset];

    const [products] = await db.query(query, finalParams);

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
      isWishlist: item.isWishlist === 1,
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

/**
 * @route   GET /api/products/search
 * @desc    Tìm kiếm sản phẩm theo từ khóa
 * @access  Public
 */
router.get("/search", async (req, res) => {
  const keyword = req.query.q?.trim() || "";
  if (!keyword) return res.json({ results: [] });

  try {
    const [rows] = await db.query(
      `
      SELECT 
        product_id AS id, 
        product_name AS name, 
        product_slug AS slug,
        product_image AS image
      FROM product
      WHERE product_status = 1 
        AND LOWER(product_name) LIKE LOWER(?)
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [`%${keyword}%`]
    );

    res.json({
      results: rows.map((item) => ({
        ...item,
        image: item.image ? String(item.image) : "",
      })),
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * @route   GET /api/products/admin
 * @desc    Lấy danh sách sản phẩm cho quản trị viên
 * @access  Private (Admin only)
 **/
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
    const formattedProducts = products.map((product) => ({
      ...product,
      price: product.price || 0,
      price_sale: product.price_sale || null, // Giữ null nếu không có giá sale
      total_quantity: product.total_quantity || 0,
      comment_count: product.comment_count || 0,
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error("Error fetching admin products:", error);
    res.status(500).json({ error: "Failed to fetch admin product list" });
  }
});

/**
 * @route   GET /api/products/related/by-room/:productId
 * @desc    Lấy sản phẩm liên quan theo room
 * @access  Public
 */
router.get("/related/by-room/:productId", optionalAuth, async (req, res) => {
  const { productId } = req.params;
  const userId = req.user?.id || 0;

  try {
    const [relatedProducts] = await db.query(
      `
      SELECT 
        p.product_id AS id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS image,
        p.category_id,
        cat.category_name,

        (
          SELECT vp.variant_product_price
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price,

        (
          SELECT vp.variant_product_price_sale
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          AND vp.variant_product_price_sale > 0
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        (
          SELECT vp.variant_id
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS variant_id,

        IFNULL(JSON_ARRAYAGG(DISTINCT col.color_hex), JSON_ARRAY()) AS color_hex,

        (
          SELECT COUNT(*) FROM comment WHERE product_id = p.product_id
        ) AS comment_count,

        (
          SELECT EXISTS (
            SELECT 1
            FROM wishlist w
            JOIN variant_product vp ON w.variant_id = vp.variant_id
            WHERE vp.product_id = p.product_id
              AND w.user_id = ?
              AND w.status = 1
          )
        ) AS isWishlist

      FROM room_product rp1
      JOIN room_product rp2 ON rp1.room_id = rp2.room_id
      JOIN product p ON p.product_id = rp2.product_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE rp1.product_id = ? AND rp2.product_id != ?
      GROUP BY p.product_id
      LIMIT 4
      `,
      [userId, productId, productId]
    );

    const result = relatedProducts.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category_id: item.category_id,
      category_name: item.category_name,
      variant_id: item.variant_id,
      price: item.price ?? 0,
      price_sale: item.price_sale ?? 0,
      color_hex: JSON.parse(item.color_hex || "[]"),
      comment_count: item.comment_count ?? 0,
      isWishlist: item.isWishlist === 1,
    }));

    res.json({ related_products: result });
  } catch (err) {
    console.error("Error fetching related products by room:", err);
    res.status(500).json({ error: "Lỗi lấy sản phẩm liên quan theo room" });
  }
});

/**
 * @route   GET /api/products/newest
 * @desc    Lấy danh sách sản phẩm mới nhất
 * @access  Public
 */
router.get("/newest", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;

  try {
    const limit = parseInt(req.query.limit) || 8;

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
          AND vp2.variant_product_price_sale > 0
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        IFNULL(JSON_ARRAYAGG(DISTINCT col.color_hex), JSON_ARRAY()) AS color_hex,

        (
          SELECT COUNT(*) FROM comment WHERE product_id = p.product_id
        ) AS comment_count,

        (
          SELECT vp2.variant_id
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS variant_id,

        (
          SELECT EXISTS (
            SELECT 1
            FROM wishlist w
            WHERE w.variant_id = (
              SELECT vp3.variant_id
              FROM variant_product vp3
              WHERE vp3.product_id = p.product_id
              ORDER BY vp3.variant_id ASC
              LIMIT 1
            )
            AND w.user_id = ?
            AND w.status = 1
          )
        ) AS isWishlist

      FROM product p
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE p.product_status = 1
      GROUP BY p.product_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `,
      [userId, limit]
    );

    const result = products.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category_id: item.category_id,
      category_name: item.category_name,
      variant_id: item.variant_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      price: item.price ?? "0.00",
      price_sale: item.price_sale ?? "0.00",
      color_hex: JSON.parse(item.color_hex || "[]"),
      comment_count: item.comment_count ?? 0,
      isWishlist: item.isWishlist === 1,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching newest products:", error);
    res.status(500).json({ error: "Failed to fetch newest products" });
  }
});

/**
 * @route   GET /api/products/variants
 * @desc    Lấy danh sách tất cả variants với thông tin sản phẩm
 * @access  Public
 */
router.get("/variants", async (req, res) => {
  try {
    const [variants] = await db.query(
      `
      SELECT
        vp.variant_id,
        vp.product_id,
        p.product_name,
        vp.color_id,
        vp.variant_product_price AS variant_product_price,
        vp.variant_product_price_sale AS variant_product_price_sale,
        vp.variant_product_quantity AS variant_product_quantity,
        vp.variant_product_slug AS variant_product_slug,
        vp.variant_product_list_image AS list_image
      FROM variant_product vp
      JOIN product p ON vp.product_id = p.product_id
      ORDER BY vp.product_id, vp.variant_id
      `
    );

    // Chuẩn hóa: lấy ảnh đầu tiên cho mỗi variant
    const result = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      product_name: v.product_name,
      color_id: v.color_id,
      price: v.variant_product_price,
      price_sale: v.variant_product_price_sale,
      quantity: v.variant_product_quantity,
      slug: v.variant_product_slug,
      first_image: v.list_image
        ? v.list_image
            .split(",")[0]
            .trim()
            .replace(/^['"]+|['"]+$/g, "")
        : null,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

const splitImages = (list) =>
  (list || "")
    .split(",")
    .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean);

router.get("/full-list-all", async (req, res) => {
  const userId = 0;
  try {
    // 1) Lấy toàn bộ product đang active
    const [products] = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_description,
        p.product_image,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.category_id,
        c.category_name,
        p.created_at,
        p.updated_at
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_status = 1
      ORDER BY p.created_at DESC
      `
    );

    if (!products.length) {
      return res.json({ products: [] });
    }

    const productIds = products.map((p) => p.product_id);
    const idParams = productIds.length ? productIds : [-1];

    // 2) Batch: variants + color (đã sắp theo priority mặc định)
    const [variantRows] = await db.query(
      `
      SELECT
        vp.product_id,
        vp.variant_id,
        vp.color_id,
        vp.variant_product_price        AS price,
        vp.variant_product_price_sale   AS price_sale,
        vp.variant_product_quantity     AS quantity,
        vp.variant_product_slug         AS variant_slug,
        vp.variant_product_list_image   AS list_image,
        col.color_name,
        col.color_hex,
        col.color_priority
      FROM variant_product vp
      JOIN color col ON vp.color_id = col.color_id
      WHERE vp.product_id IN (${idParams.map(() => "?").join(",")})
      ORDER BY col.color_priority = 1 DESC, col.color_priority ASC, vp.variant_id ASC
      `,
      idParams
    );

    // 3) Batch: rooms
    const [roomRows] = await db.query(
      `
      SELECT rp.product_id, r.room_id, r.room_name, r.slug
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id IN (${idParams.map(() => "?").join(",")})
      `,
      idParams
    );

    // 4) Batch: attributes (chỉ các attr có value cho sản phẩm)
    const [attrRows] = await db.query(
      `
      SELECT
        pav.product_id,
        a.attribute_id,
        a.attribute_name,
        a.unit,
        a.is_required,
        a.value_type,
        CASE
          WHEN pav.value IS NOT NULL AND pav.value <> '' THEN pav.value
          WHEN m.material_name IS NOT NULL THEN m.material_name
          ELSE NULL
        END AS value_display,
        pav.value AS raw_value,
        pav.material_id
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id IN (${idParams.map(() => "?").join(",")})
      ORDER BY a.attribute_name ASC
      `,
      idParams
    );

    // 5) Batch: comment_count
    const [commentAgg] = await db.query(
      `
      SELECT product_id, COUNT(*) AS comment_count
      FROM comment
      WHERE product_id IN (${idParams
        .map(() => "?")
        .join(",")}) AND deleted_at IS NULL
      GROUP BY product_id
      `,
      idParams
    );

    // 6) Batch: total_stock
    const [stockAgg] = await db.query(
      `
      SELECT product_id, COALESCE(SUM(variant_product_quantity),0) AS total_stock
      FROM variant_product
      WHERE product_id IN (${idParams.map(() => "?").join(",")})
      GROUP BY product_id
      `,
      idParams
    );

    // 7) Gom variants theo product và xác định default_variant_id
    const variantsByPid = new Map();
    for (const v of variantRows) {
      if (!variantsByPid.has(v.product_id)) variantsByPid.set(v.product_id, []);
      variantsByPid.get(v.product_id).push(v);
    }

    const defaultVariantByPid = new Map();
    for (const pid of productIds) {
      const list = variantsByPid.get(pid) || [];
      defaultVariantByPid.set(pid, list[0]?.variant_id || null);
    }

    // 8) Batch wishlist theo default_variant_id (nếu có user)
    let wishlistSet = new Set();
    if (userId) {
      const defaultVariantIds = Array.from(defaultVariantByPid.values()).filter(
        Boolean
      );
      if (defaultVariantIds.length) {
        const [wlRows] = await db.query(
          `
          SELECT variant_id
          FROM wishlist
          WHERE user_id = ? AND status = 1
            AND variant_id IN (${defaultVariantIds.map(() => "?").join(",")})
          `,
          [userId, ...defaultVariantIds]
        );
        wishlistSet = new Set(wlRows.map((r) => r.variant_id));
      }
    }

    // 9) Build các map phụ
    const roomsByPid = new Map();
    for (const r of roomRows) {
      if (!roomsByPid.has(r.product_id)) roomsByPid.set(r.product_id, []);
      roomsByPid.get(r.product_id).push({
        room_id: r.room_id,
        room_name: r.room_name,
        slug: r.slug,
      });
    }

    const attrsByPid = new Map();
    for (const a of attrRows) {
      if (!attrsByPid.has(a.product_id)) attrsByPid.set(a.product_id, []);
      attrsByPid.get(a.product_id).push({
        attribute_id: a.attribute_id,
        name: a.attribute_name,
        unit: a.unit,
        is_required: !!a.is_required,
        value_type: a.value_type,
        value_display: a.value_display,
        raw_value: a.raw_value,
        material_id: a.material_id,
      });
    }

    const commentByPid = new Map(
      commentAgg.map((r) => [r.product_id, r.comment_count])
    );
    const stockByPid = new Map(
      stockAgg.map((r) => [r.product_id, r.total_stock])
    );

    // 10) Kết xuất toàn bộ list
    const result = products.map((p) => {
      const vListRaw = variantsByPid.get(p.product_id) || [];
      const vList = vListRaw.map((v) => ({
        variant_id: v.variant_id,
        product_id: v.product_id,
        color_id: v.color_id,
        color_name: v.color_name,
        color_hex: v.color_hex,
        color_priority: v.color_priority,
        price: v.price,
        price_sale: v.price_sale,
        quantity: v.quantity,
        slug: v.variant_slug,
        images: splitImages(v.list_image),
      }));

      // default variant = phần tử đầu tiên (đã sắp theo priority)
      const dv = vList[0] || null;

      // Tính min_price / min_price_sale / min_actual_price từ vList
      let min_price = null,
        min_price_sale = null,
        min_actual_price = null;
      for (const it of vList) {
        if (min_price === null || (it.price ?? Infinity) < min_price)
          min_price = it.price ?? null;
        if (it.price_sale > 0) {
          if (min_price_sale === null || it.price_sale < min_price_sale)
            min_price_sale = it.price_sale;
          if (min_actual_price === null || it.price_sale < min_actual_price)
            min_actual_price = it.price_sale;
        }
      }
      if (min_actual_price === null) min_actual_price = min_price;

      const colors = vList.map((v) => ({
        colorId: v.color_id,
        colorName: v.color_name,
        colorHex: v.color_hex,
        slug: v.slug,
      }));

      return {
        id: p.product_id,
        name: p.product_name,
        slug: p.product_slug,
        description: p.product_description,
        main_image: (p.product_image || "")
          .trim()
          .replace(/^['"]+|['"]+$/g, ""),
        sold: p.product_sold,
        view: p.product_view,
        status: p.product_status,
        category_id: p.category_id,
        category_name: p.category_name,
        created_at: p.created_at,
        updated_at: p.updated_at,

        min_price,
        min_price_sale,
        min_actual_price,

        default_variant: dv
          ? {
              variant_id: dv.variant_id,
              color_name: dv.color_name,
              color_hex: dv.color_hex,
              price: dv.price,
              price_sale: dv.price_sale,
              quantity: dv.quantity,
              slug: dv.slug,
              images: dv.images,
            }
          : null,

        variants: vList,
        colors,
        rooms: roomsByPid.get(p.product_id) || [],
        attributes: attrsByPid.get(p.product_id) || [],
        total_stock: stockByPid.get(p.product_id) ?? 0,
        comment_count: commentByPid.get(p.product_id) ?? 0,
        isWishlist: dv ? wishlistSet.has(dv.variant_id) : false,
      };
    });

    return res.json({ products: result });
  } catch (err) {
    console.error("[FULL LIST ALL] Error:", err);
    return res.status(500).json({ error: "Failed to fetch full product list" });
  }
});

// GỢI Ý: tạo endpoint mới để phục vụ AI, không ảnh hưởng client hiện có
router.get("/ai-catalog", async (req, res) => {
  const userId = 0; // hoặc lấy từ auth nếu cần
  try {
    // 1) Lấy toàn bộ product đang active (chỉ field cần thiết)
    const [products] = await db.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_description,
        p.product_status,
        p.category_id,
        c.category_name,
        p.created_at,
        p.updated_at
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_status = 1
      ORDER BY p.created_at DESC
      LIMIT 6
    `);

    if (!products.length) {
      return res.json({ items: [] });
    }

    const productIds = products.map((p) => p.product_id);
    const idParams = productIds.length ? productIds : [-1];
    const inClause = productIds.map(() => "?").join(",");

    // 2) Variants + màu (đã sắp theo priority)
    const [variantRows] = await db.query(
      `
      SELECT
        vp.product_id,
        vp.variant_id,
        vp.color_id,
        vp.variant_product_price        AS price,
        vp.variant_product_price_sale   AS price_sale,
        vp.variant_product_quantity     AS quantity,
        vp.variant_product_slug         AS variant_slug,
        col.color_name,
        col.color_hex,
        col.color_priority
      FROM variant_product vp
      JOIN color col ON vp.color_id = col.color_id
      WHERE vp.product_id IN (${inClause})
      ORDER BY col.color_priority = 1 DESC, col.color_priority ASC, vp.variant_id ASC
      `,
      idParams
    );

    // 3) Rooms
    const [roomRows] = await db.query(
      `
      SELECT rp.product_id, r.room_id, r.room_name, r.slug
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id IN (${inClause})
      `,
      idParams
    );

    // 4) Attributes (chỉ attr có value)
    const [attrRows] = await db.query(
      `
      SELECT
        pav.product_id,
        a.attribute_id,
        a.attribute_name,
        a.unit,
        a.is_required,
        a.value_type,
        CASE
          WHEN pav.value IS NOT NULL AND pav.value <> '' THEN pav.value
          WHEN m.material_name IS NOT NULL THEN m.material_name
          ELSE NULL
        END AS value_display,
        pav.value AS raw_value,
        pav.material_id
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id IN (${inClause})
      ORDER BY a.attribute_name ASC
      `,
      idParams
    );

    // 5) comment_count
    const [commentAgg] = await db.query(
      `
      SELECT product_id, COUNT(*) AS comment_count
      FROM comment
      WHERE product_id IN (${inClause}) AND deleted_at IS NULL
      GROUP BY product_id
      `,
      idParams
    );

    // 6) total_stock
    const [stockAgg] = await db.query(
      `
      SELECT product_id, COALESCE(SUM(variant_product_quantity),0) AS total_stock
      FROM variant_product
      WHERE product_id IN (${inClause})
      GROUP BY product_id
      `,
      idParams
    );

    // --- Build map phụ ---
    const variantsByPid = new Map();
    for (const v of variantRows) {
      if (!variantsByPid.has(v.product_id)) variantsByPid.set(v.product_id, []);
      variantsByPid.get(v.product_id).push(v);
    }

    const roomsByPid = new Map();
    for (const r of roomRows) {
      if (!roomsByPid.has(r.product_id)) roomsByPid.set(r.product_id, []);
      roomsByPid.get(r.product_id).push({
        room_id: r.room_id,
        room_name: r.room_name,
        slug: r.slug,
      });
    }

    const attrsByPid = new Map();
    for (const a of attrRows) {
      if (!attrsByPid.has(a.product_id)) attrsByPid.set(a.product_id, []);
      // Bỏ trường rác (không có value)
      if (a.value_display == null || a.value_display === "") continue;
      attrsByPid.get(a.product_id).push({
        attribute_id: a.attribute_id,
        name: a.attribute_name,
        unit: a.unit || "",
        is_required: !!a.is_required,
        value_type: a.value_type,
        value_display: a.value_display,
        raw_value: a.raw_value,
        material_id: a.material_id,
      });
    }

    const commentByPid = new Map(
      commentAgg.map((r) => [r.product_id, Number(r.comment_count || 0)])
    );
    const stockByPid = new Map(
      stockAgg.map((r) => [r.product_id, Number(r.total_stock || 0)])
    );

    // --- Helper để chuẩn hoá giá & text ---
    const sanitizePrice = (price) => {
      const n = Number(price);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const computeActualPrice = (price, price_sale) => {
      const p = sanitizePrice(price);
      const ps = sanitizePrice(price_sale);
      if (ps != null && p != null && ps > 0 && ps < p) return ps;
      return p ?? ps ?? null;
    };
    const buildAttributesText = (attrs = []) => {
      return attrs
        .map((x) => {
          const unit = x.unit ? ` ${x.unit}` : "";
          return `${x.name}: ${x.value_display}${unit}`;
        })
        .join("; ");
    };
    const compactText = (s) => (s || "").replace(/\s+/g, " ").trim();

    // --- Kết xuất: MỖI BIẾN THỂ = 1 DOCUMENT gọn cho AI ---
    const items = [];
    for (const p of products) {
      const pid = p.product_id;
      const vListRaw = variantsByPid.get(pid) || [];

      // Rooms & attributes dùng chung theo sản phẩm
      const rooms = roomsByPid.get(pid) || [];
      const attributes = attrsByPid.get(pid) || [];
      const attributes_text = buildAttributesText(attributes);

      // Text mô tả ngắn gọn
      const description_plain = compactText(p.product_description);

      // Search blob (để embedding)
      const baseBlob = [
        p.product_name,
        p.category_name,
        description_plain,
        attributes_text,
        rooms.map((r) => r.room_name).join(", "),
      ]
        .filter(Boolean)
        .join(" — ");

      // total_stock & comment_count cấp sản phẩm (để hiển thị/ưu tiên)
      const total_stock = Number(stockByPid.get(pid) ?? 0);
      const comment_count = Number(commentByPid.get(pid) ?? 0);

      // Với mỗi biến thể → 1 record gọn
      for (const v of vListRaw) {
        const price = sanitizePrice(v.price);
        const price_sale = sanitizePrice(v.price_sale);
        const actual_price = computeActualPrice(price, price_sale);
        const quantity = Number(v.quantity ?? 0);
        const is_in_stock = quantity > 0;

        items.push({
          // ID & nhận diện
          doc_id: `product:${pid}:variant:${v.variant_id}`,
          product_id: pid,
          variant_id: v.variant_id,

          // Thông tin hiển thị chính
          name: p.product_name,
          category: p.category_name,
          slug: p.product_slug,
          variant_slug: v.variant_slug,
          color_name: v.color_name,
          color_hex: v.color_hex,

          // Giá & tồn
          price,
          price_sale,
          actual_price,
          is_in_stock,
          quantity,
          total_stock,
          comment_count,

          // Ngữ nghĩa & bối cảnh
          rooms: rooms.map((r) => ({
            room_id: r.room_id,
            room_name: r.room_name,
            slug: r.slug,
          })),
          attributes, // vẫn giữ mảng chi tiết (không ảnh, gọn)
          attributes_text, // chuỗi rút gọn, tiện embed/search
          description_plain, // mô tả ngắn gọn (đã compact)
          search_blob: compactText(
            `${baseBlob} — Màu: ${v.color_name} ${v.color_hex || ""}`
          ),

          // Dấu thời gian
          created_at: p.created_at,
          updated_at: p.updated_at,
        });
      }
    }

    return res.json({ items });
  } catch (err) {
    console.error("[AI-CATALOG] Error:", err);
    return res.status(500).json({ error: "Failed to build AI catalog" });
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Lấy thông tin chi tiết một sản phẩm
 * @access  Public
 */
router.get("/test/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  try {
    // Tăng view trước khi lấy dữ liệu
    db.query(
      `UPDATE product SET product_view = product_view + 1 WHERE product_slug = ?`,
      [slug]
    );
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

    const variantsFull = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image
        ? v.list_image
            .split(",")
            .map((img) => img.trim().replace(/^['"]+|['"]+$/g, ""))
        : [],
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

    const [categoryAttributesDefinitions] = await db.query(
      `
      SELECT
          attribute_id,
          attribute_name,
          unit,
          is_required
      FROM
          attributes
      WHERE
          category_id = ?
      ORDER BY
          attribute_name; -- Hoặc sử dụng một cột 'display_order' nếu có
      `,
      [product.category_id]
    );

    const [productAttributeValues] = await db.query(
      `
      SELECT
          pav.attribute_id,
          CASE
              WHEN pav.value IS NOT NULL AND pav.value != '' THEN pav.value
              WHEN m.material_name IS NOT NULL THEN m.material_name
              ELSE NULL
          END AS value
      FROM
          product_attribute_value AS pav
      LEFT JOIN
          materials AS m ON pav.material_id = m.material_id
      WHERE
          pav.product_id = ?;
      `,
      [product.product_id]
    );

    const finalAttributes = categoryAttributesDefinitions.map((definedAttr) => {
      const productValue = productAttributeValues.find(
        (pav) => pav.attribute_id === definedAttr.attribute_id
      );
      return {
        name: definedAttr.attribute_name,
        value: productValue ? productValue.value : null,
        unit: definedAttr.unit,
        is_required: definedAttr.is_required,
      };
    });

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

        status: product.product_status,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        defaultPrice: defaultVariant?.price ?? null,
        defaultPriceSale: defaultVariant?.price_sale ?? null,
        defaultImages:
          defaultVariant?.list_image
            ?.split(",")
            .map((img) => img.trim().replace(/^['"]+|['"]+$/g, "")) ?? [],
        main_image: product.product_image
          ? product.product_image.trim().replace(/^['"]+|['"]+$/g, "")
          : "",
        defaultSlug: defaultVariant?.slug ?? null,
        defaultColorName: defaultVariant?.color_name ?? null,
        defaultColorHex: defaultVariant?.color_hex ?? null,
        defaultQuantity: defaultVariant?.quantity ?? null,
        variants: variantsFull,
        // --- Sử dụng mảng thuộc tính đã kết hợp ở đây ---
        attributes: finalAttributes,
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
    const variantsFull = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image
        ? v.list_image
            .split(",")
            .map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, ""))
        : [],
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
          defaultVariant?.list_image
            ?.split(",")
            .map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, "")) ?? [],
        main_image: product.product_image
          ? product.product_image.trim().replace(/^['\"]+|['\"]+$/g, "")
          : "",
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
router.put("/:id", async (req, res) => {
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
router.delete("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    function extractPublicIdFromUrl(url) {
      if (!url) return null;
      const match = url.match(
        /\/upload\/(?:v\d+\/)?(.+?)(?:\.\w{3,4})?(?:\?.*)?$/
      );
      if (match && match[1]) {
        let publicId = match[1];
        const lastDotIndex = publicId.lastIndexOf(".");
        if (lastDotIndex > -1 && publicId.substring(lastDotIndex).length <= 5) {
          publicId = publicId.substring(0, lastDotIndex);
        }
        return publicId;
      }
      return null;
    }

    const [existingProduct] = await connection.query(
      "SELECT product_id, product_image FROM product WHERE product_slug = ?",
      [slug]
    );
    if (!existingProduct.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }

    const { product_id, product_image } = existingProduct[0];

    const [variants] = await connection.query(
      "SELECT variant_id, variant_product_list_image FROM variant_product WHERE product_id = ?",
      [product_id]
    );

    const variantIds = variants.map((v) => v.variant_id);

    if (variantIds.length > 0) {
      const [orderItems] = await connection.query(
        `SELECT order_item_id FROM order_items WHERE variant_id IN (${variantIds
          .map(() => "?")
          .join(",")}) LIMIT 1`,
        variantIds
      );
      if (orderItems.length > 0) {
        await connection.query(
          "UPDATE product SET product_status = 0 WHERE product_id = ?",
          [product_id]
        );
        await connection.commit();
        return res.json({
          message:
            "Sản phẩm đang được mua trong đơn hàng, không thể xoá. Trạng thái đã được chuyển sang 'ẩn'.",
        });
      }
    }

    for (const variant of variants) {
      const imageUrls = variant.variant_product_list_image
        ? variant.variant_product_list_image.split(",")
        : [];
      for (const url of imageUrls) {
        const trimmedUrl = url.trim();
        const publicId = extractPublicIdFromUrl(trimmedUrl);
        if (publicId) {
          try {
            console.log(`Đang xóa ảnh variant: ${publicId}`);
            await cloudinary.uploader.destroy(publicId);
            console.log(`Đã xóa ảnh variant: ${publicId}`);
          } catch (err) {
            console.error(
              "Lỗi khi xoá ảnh variant:",
              publicId,
              err.message,
              err.http_code
            );
          }
        } else {
          console.warn(
            `Không thể trích xuất publicId từ URL variant: ${trimmedUrl}`
          );
        }
      }
    }

    if (product_image) {
      const publicId = extractPublicIdFromUrl(product_image.trim());
      if (publicId) {
        try {
          console.log(`Đang xóa ảnh chính sản phẩm: ${publicId}`);
          await cloudinary.uploader.destroy(publicId);
          console.log(`Đã xóa ảnh chính sản phẩm: ${publicId}`);
        } catch (err) {
          console.error(
            "Lỗi khi xoá ảnh sản phẩm chính:",
            publicId,
            err.message,
            err.http_code
          );
        }
      } else {
        console.warn(
          `Không thể trích xuất publicId từ URL ảnh chính sản phẩm: ${product_image.trim()}`
        );
      }
    }

    await connection.query("DELETE FROM comment WHERE product_id = ?", [
      product_id,
    ]);

    await connection.query(
      "DELETE FROM product_attribute_value WHERE product_id = ?",
      [product_id]
    );

    await connection.query("DELETE FROM variant_product WHERE product_id = ?", [
      product_id,
    ]);
    await connection.query("DELETE FROM room_product WHERE product_id = ?", [
      product_id,
    ]);

    if (variantIds.length > 0) {
      await connection.query(
        `DELETE FROM wishlist WHERE variant_id IN (${variantIds
          .map(() => "?")
          .join(",")})`,
        variantIds
      );
    }

    await connection.query("DELETE FROM product WHERE product_id = ?", [
      product_id,
    ]);

    await connection.commit();
    res.json({ message: "Xoá sản phẩm thành công" });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  } finally {
    connection.release();
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
router.put("/status/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { product_status } = req.body;
  if (isNaN(id) || ![0, 1].includes(Number(product_status))) {
    return res.status(400).json({ error: "Invalid product id or status" });
  }
  try {
    const [result] = await db.query(
      "UPDATE product SET product_status = ? WHERE product_id = ?",
      [product_status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product status updated successfully" });
  } catch (err) {
    console.error("Error updating product status:", err);
    res.status(500).json({ error: "Failed to update product status" });
  }
});
/**
 * @route   POST /api/products/add
 * @desc    Thêm sản phẩm mới (Admin)
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
      main_image,
      room_ids,
      variants,
      attributes,
    } = req.body;

    const errors = [];

    const isEmpty = (val) =>
      val === undefined || val === null || String(val).trim() === "";
    const isNumber = (val) => !isEmpty(val) && !isNaN(Number(val));

    if (isEmpty(name)) {
      errors.push({ field: "name", message: "Tên sản phẩm là bắt buộc" });
    }
    if (isEmpty(description)) {
      errors.push({
        field: "description",
        message: "Mô tả sản phẩm là bắt buộc",
      });
    }
    if (isEmpty(slug)) {
      errors.push({ field: "slug", message: "Slug là bắt buộc" });
    }
    if (isEmpty(category_id)) {
      errors.push({ field: "category_id", message: "Danh mục là bắt buộc" });
    }
    if (isEmpty(status)) {
      errors.push({ field: "status", message: "Vui lòng chọn trạng thái" });
    } else if (![0, 1, "0", "1"].includes(status)) {
      errors.push({ field: "status", message: "Trạng thái không hợp lệ" });
    }
    if (isEmpty(main_image)) {
      errors.push({
        field: "main_image",
        message: "Ảnh chính sản phẩm là bắt buộc",
      });
    }
    if (!Array.isArray(room_ids) || room_ids.length === 0) {
      errors.push({
        field: "room_ids",
        message: "Vui lòng chọn ít nhất một phòng",
      });
    }

    let requiredAttributesFromDB = [];
    if (category_id) {
      const [dbAttrs] = await db.query(
        `SELECT attribute_id, is_required FROM attributes WHERE category_id = ?`,
        [category_id]
      );
      requiredAttributesFromDB = dbAttrs;
    }

    if (!Array.isArray(attributes)) {
      errors.push({
        field: "attributes",
        message: "Dữ liệu thuộc tính sản phẩm không hợp lệ.",
      });
    } else {
      const submittedAttributesMap = new Map();
      attributes.forEach((attr) => {
        submittedAttributesMap.set(attr.attribute_id, attr);
      });

      requiredAttributesFromDB.forEach((requiredAttr) => {
        const submittedAttr = submittedAttributesMap.get(
          requiredAttr.attribute_id
        );
        if (
          requiredAttr.is_required &&
          (!submittedAttr ||
            (isEmpty(submittedAttr.value) &&
              isEmpty(submittedAttr.material_id)))
        ) {
          errors.push({
            field: `attributes`,
            message: `Thuộc tính bắt buộc (ID: ${requiredAttr.attribute_id}) còn thiếu hoặc chưa có giá trị.`,
          });
        }
      });

      attributes.forEach((attr, i) => {
        if (isEmpty(attr.attribute_id)) {
          errors.push({
            field: `attributes[${i}].attribute_id`,
            message: `Thuộc tính ${i + 1}: Thiếu ID thuộc tính.`,
          });
        }

        if (!isEmpty(attr.value) && !isEmpty(attr.material_id)) {
          errors.push({
            field: `attributes[${i}]`,
            message: `Thuộc tính ${
              i + 1
            }: Không thể có cả giá trị và ID chất liệu.`,
          });
        }
      });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      errors.push({
        field: "variants",
        message: "Phải có ít nhất một biến thể sản phẩm",
      });
    } else {
      variants.forEach((v, i) => {
        const idx = i + 1;
        if (isEmpty(v.color_id)) {
          errors.push({
            field: `variants[${i}].color_id`,
            message: `Biến thể ${idx}: Thiếu màu sắc`,
          });
        }
        if (isEmpty(v.variant_slug)) {
          errors.push({
            field: `variants[${i}].variant_slug`,
            message: `Biến thể ${idx}: Thiếu slug`,
          });
        }
        if (!isNumber(v.price)) {
          errors.push({
            field: `variants[${i}].price`,
            message: `Biến thể ${idx}: Giá không hợp lệ`,
          });
        }
        if (!isNumber(v.quantity)) {
          errors.push({
            field: `variants[${i}].quantity`,
            message: `Biến thể ${idx}: Số lượng không hợp lệ`,
          });
        }
        if (!Array.isArray(v.list_image) || v.list_image.length === 0) {
          errors.push({
            field: `variants[${i}].list_image`,
            message: `Biến thể ${idx}: Cần ít nhất 1 ảnh`,
          });
        } else {
          v.list_image.forEach((img, j) => {
            if (typeof img !== "string" || !img.startsWith("http")) {
              errors.push({
                field: `variants[${i}].list_image[${j}]`,
                message: `Ảnh ${j + 1} của biến thể ${idx} không hợp lệ`,
              });
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ", errors });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();
    try {
      const [productResult] = await connection.query(
        `INSERT INTO product (
          product_name,
          product_description,
          product_slug,
          category_id,
          product_status,
          product_image,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [name, description, slug, category_id, status, main_image]
      );
      const productId = productResult.insertId;

      if (attributes.length > 0) {
        const attributeValues = attributes.map((attr) => [
          productId,
          attr.attribute_id,
          attr.value === undefined || attr.value === "" ? null : attr.value,
          attr.material_id === undefined || attr.material_id === ""
            ? null
            : attr.material_id,
        ]);
        await connection.query(
          `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ?`,
          [attributeValues]
        );
      }

      for (const v of variants) {
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
            v.color_id,
            v.price,
            v.price_sale || null,
            v.quantity,
            v.list_image.join(","),
            v.variant_slug,
          ]
        );
      }

      if (room_ids.length > 0) {
        const roomValues = room_ids.map((rid) => [productId, rid]);
        await connection.query(
          `INSERT INTO room_product (product_id, room_id) VALUES ?`,
          [roomValues]
        );
      }

      await connection.commit();
      return res
        .status(201)
        .json({ message: "Tạo sản phẩm thành công", product_id: productId });
    } catch (insertErr) {
      await connection.rollback();
      console.error("Lỗi trong giao dịch:", insertErr);
      return res.status(500).json({
        error: "Lỗi server khi tạo sản phẩm",
        details: insertErr.message,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Lỗi tổng thể khi tạo sản phẩm:", err);
    return res.status(500).json({ error: "Lỗi server", details: err.message });
  }
});

/**
 *  @route   PUT /api/products/admin/:slug
 *  @desc    Cập nhật sản phẩm
 *  @access  Private (Admin only)
 */

router.put("/admin/:slug", async (req, res) => {
  const { slug: currentSlug } = req.params;
  const {
    name,
    description,
    category_id,
    status,
    main_image,
    room_ids,
    removedImages = [],
    slug,
    attributes,
  } = req.body;

  const errors = [];
  const isEmpty = (val) =>
    val === undefined || val === null || String(val).trim() === "";
  const isNumber = (val) => !isEmpty(val) && !isNaN(Number(val));

  if (isEmpty(name)) {
    errors.push({ field: "name", message: "Tên sản phẩm là bắt buộc" });
  }
  if (isEmpty(description)) {
    errors.push({
      field: "description",
      message: "Mô tả sản phẩm là bắt buộc",
    });
  }
  if (isEmpty(slug)) {
    errors.push({ field: "slug", message: "Slug là bắt buộc" });
  }

  if (!isEmpty(slug)) {
    try {
      const [existingSlug] = await db.query(
        `SELECT product_id FROM product WHERE product_slug = ? AND product_id <> (SELECT product_id FROM product WHERE product_slug = ?)`,
        [slug, currentSlug]
      );
      if (existingSlug.length > 0) {
        errors.push({
          field: "slug",
          message: "Slug đã tồn tại. Vui lòng chọn slug khác.",
        });
      }
    } catch (dbErr) {
      console.error("Error checking slug uniqueness:", dbErr);
      errors.push({ field: "slug", message: "Lỗi kiểm tra slug duy nhất." });
    }
  }

  if (isEmpty(category_id)) {
    errors.push({ field: "category_id", message: "Danh mục là bắt buộc" });
  }
  if (isEmpty(status)) {
    errors.push({ field: "status", message: "Vui lòng chọn trạng thái" });
  } else if (![0, 1, "0", "1"].includes(status)) {
    errors.push({ field: "status", message: "Trạng thái không hợp lệ" });
  }
  if (isEmpty(main_image)) {
    errors.push({
      field: "main_image",
      message: "Ảnh chính sản phẩm là bắt buộc",
    });
  }

  if (!Array.isArray(attributes)) {
    errors.push({
      field: "attributes",
      message: "Dữ liệu thuộc tính không hợp lệ.",
    });
  } else {
    try {
      const [categoryAttributesMeta] = await db.query(
        `SELECT attribute_id, attribute_name, value_type, is_required
             FROM attributes
             WHERE category_id = ?`,
        [category_id]
      );

      const categoryAttributeMap = new Map(
        categoryAttributesMeta.map((attr) => [attr.attribute_id, attr])
      );

      const payloadAttributeIds = new Set(
        attributes.map((attr) => attr.attribute_id)
      );

      for (const payloadAttr of attributes) {
        const meta = categoryAttributeMap.get(payloadAttr.attribute_id);

        if (!meta) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}]`,
            message: `Thuộc tính ID ${payloadAttr.attribute_id} không hợp lệ cho danh mục này.`,
          });
          continue;
        }

        if (meta.is_required) {
          if (meta.value_type === "material_id") {
            if (isEmpty(payloadAttr.material_id)) {
              errors.push({
                field: `attributes[${payloadAttr.attribute_id}].material_id`,
                message: `Thuộc tính "${meta.attribute_name}" (chất liệu) là bắt buộc.`,
              });
            }
          } else {
            if (isEmpty(payloadAttr.value)) {
              errors.push({
                field: `attributes[${payloadAttr.attribute_id}].value`,
                message: `Thuộc tính "${meta.attribute_name}" là bắt buộc.`,
              });
            }
          }
        }

        if (
          meta.value_type === "number" &&
          !isEmpty(payloadAttr.value) &&
          !isNumber(payloadAttr.value)
        ) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}].value`,
            message: `Giá trị cho "${meta.attribute_name}" phải là số hợp lệ.`,
          });
        }

        if (
          meta.value_type === "material_id" &&
          !isEmpty(payloadAttr.material_id)
        ) {
          const [materialExists] = await db.query(
            `SELECT material_id FROM materials WHERE material_id = ?`,
            [payloadAttr.material_id]
          );
          if (materialExists.length === 0) {
            errors.push({
              field: `attributes[${payloadAttr.attribute_id}].material_id`,
              message: `Chất liệu ID ${payloadAttr.material_id} không tồn tại.`,
            });
          }
        }
      }

      for (const meta of categoryAttributesMeta) {
        if (meta.is_required && !payloadAttributeIds.has(meta.attribute_id)) {
          errors.push({
            field: `attributes[${meta.attribute_id}]`,
            message: `Thuộc tính "${meta.attribute_name}" là bắt buộc nhưng bị thiếu.`,
          });
        }
      }
    } catch (attrErr) {
      console.error("Error validating dynamic attributes:", attrErr);
      errors.push({
        field: "attributes",
        message: "Lỗi server khi xác thực thuộc tính.",
      });
    }
  }

  if (!Array.isArray(room_ids) || room_ids.length === 0) {
    errors.push({
      field: "room_ids",
      message: "Vui lòng chọn ít nhất một phòng",
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ", errors });
  }

  if (removedImages.length) {
    for (const imageUrl of removedImages) {
      const matches = imageUrl.match(
        /\/upload\/(?:v\d+\/)?(.+?)\.(jpg|jpeg|png|webp|gif)$/
      );
      const publicId = matches ? matches[1] : null;

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log("🗑️ Đã xoá ảnh Cloudinary:", publicId);
        } catch (destroyErr) {
          console.warn(
            "Không thể xoá ảnh Cloudinary:",
            publicId,
            destroyErr.message
          );
        }
      }
    }
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [productRows] = await connection.query(
      `SELECT product_id, product_priority FROM product WHERE product_slug = ?`,
      [currentSlug]
    );
    if (!productRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Product not found" });
    }
    const productId = productRows[0].product_id;
    const currentPriority = productRows[0].product_priority;

    let newPriority = currentPriority;
    if (currentPriority === 0) {
      const [maxPriorityResult] = await connection.query(
        `SELECT MAX(product_priority) AS max_priority FROM product`
      );
      const maxPriority = maxPriorityResult[0].max_priority || 0;
      newPriority = maxPriority + 1;
      console.log(
        `Debug: Product ID ${productId}, currentPriority was 0, newPriority calculated: ${newPriority}`
      );
    } else {
      console.log(
        `Debug: Product ID ${productId}, currentPriority is ${currentPriority}, not recalculating priority.`
      );
    }

    await connection.query(
      `UPDATE product SET
        product_name = ?,
        product_slug = ?,
        product_description = ?,
        category_id = ?,
        product_status = ?,
        product_image = ?,
        product_priority = ?
      WHERE product_id = ?`,
      [
        name,
        slug,
        description,
        category_id,
        status,
        main_image,
        newPriority,
        productId,
      ]
    );

    await connection.query(
      `DELETE FROM product_attribute_value WHERE product_id = ?`,
      [productId]
    );

    if (attributes && attributes.length > 0) {
      const attributeValues = attributes.map((attr) => [
        productId,
        attr.attribute_id,
        attr.value,
        attr.material_id,
      ]);
      await connection.query(
        `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ?`,
        [attributeValues]
      );
    }

    await connection.query(`DELETE FROM room_product WHERE product_id = ?`, [
      productId,
    ]);
    if (room_ids.length > 0) {
      const roomValues = room_ids.map((roomId) => [productId, roomId]);
      await connection.query(
        `INSERT INTO room_product (product_id, room_id) VALUES ?`,
        [roomValues]
      );
    }

    await connection.commit();

    const [updatedProductRows] = await db.query(
      `SELECT
        p.*,
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_id = ?`,
      [productId]
    );

    const [productAttributesValues] = await db.query(
      `SELECT pav.attribute_id, pav.value, pav.material_id, a.attribute_name, a.unit, a.is_required, a.value_type
         FROM product_attribute_value pav
         JOIN attributes a ON pav.attribute_id = a.attribute_id
         WHERE pav.product_id = ?`,
      [productId]
    );

    res.json({
      message: "Product updated successfully",
      product: {
        ...updatedProductRows[0],
        attributes: productAttributesValues,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating product:", error);
    res.status(500).json({
      error: "Failed to update product",
      details: error.message,
    });
  } finally {
    connection.release();
  }
});

/*
 * @route   GET /api/products/admin/:slug
 * @desc    Lấy thông tin chi tiết sản phẩm (Admin)
 * @access  Private (Admin only)
 */

router.get("/admin/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug không hợp lệ" });

  try {
    // 1. Lấy thông tin sản phẩm chính

    const [productRows] = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_description,
        p.product_slug,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.category_id,
        p.product_image,
        p.created_at,
        p.updated_at,
        p.variant_materials,       -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_height,          -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_width,           -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_depth,           -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_seating_height,  -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_maximum_weight_load, -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_slug = ?
      `,
      [slug]
    );

    if (!productRows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productRows[0];

    // 2. Lấy danh sách biến thể + màu sắc
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

    const variantsFull = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image
        ? v.list_image
            .split(",")
            .map((img) => img.trim().replace(/^['"]+|['"]+$/g, ""))
        : [],
    }));

    // 3. Lấy danh sách phòng
    const [rooms] = await db.query(
      `
      SELECT rp.room_id, r.room_name
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = ?
      `,
      [product.product_id]
    );

    // 4. Lấy các thuộc tính động từ bảng product_attribute_value
    const [productAttributes] = await db.query(
      `
      SELECT
          pav.attribute_id,
          pav.value,
          pav.material_id,
          a.attribute_name,
          a.unit,
          a.is_required,
          a.value_type -- Lấy trực tiếp value_type từ bảng attributes
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      WHERE pav.product_id = ?
      `,
      [product.product_id]
    );

    return res.json({
      product: {
        id: product.product_id,
        name: product.product_name,
        description: product.product_description,
        slug: product.product_slug,
        sold: product.product_sold,
        view: product.product_view,
        status: product.product_status,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        main_image: product.product_image
          ? product.product_image.trim().replace(/^['"]+|['"]+$/g, "")
          : "",
        variants: variantsFull,
        attributes: productAttributes,
        materials: product.variant_materials,
        height: product.variant_height,
        width: product.variant_width,
        depth: product.variant_depth,
        seating_height: product.variant_seating_height,
        max_weight_load: product.variant_maximum_weight_load,
      },
      rooms,
    });
  } catch (error) {
    console.error("Error fetching product details (admin):", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

module.exports = router;
