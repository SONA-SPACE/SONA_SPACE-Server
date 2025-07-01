const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/upload");

const formatImageList = (list) => {
  if (Array.isArray(list)) return list.join(",");
  if (typeof list === "string") return list;
  return null;
};
/**
 * @route   GET /api/variants
 * @desc    Lấy danh sách biến thể sản phẩm
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const product_id = req.query.product_id;

    let query = "SELECT * FROM variant_product";
    let params = [];

    if (product_id) {
      query += " WHERE product_id = ?";
      params.push(product_id);
    }

    query += " ORDER BY variant_id ASC";

    const [variants] = await db.query(query, params);
    res.json(variants);
  } catch (error) {
    console.error("Error fetching variants:", error);
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

/**
 * @route   GET /api/variants/:id
 * @desc    Lấy thông tin chi tiết một biến thể
 * @access  Public
 */
router.get("/:productSlug/:colorId", async (req, res) => {
  try {
    const { productSlug, colorId } = req.params;

    if (!productSlug || !colorId) {
      return res.status(400).json({ error: "Thiếu productSlug hoặc colorId" });
    }

    // Truy vấn variant và thông tin color theo product_slug và color_id
    const [rows] = await db.query(
      `
     SELECT 
      vp.variant_id,
      vp.product_id,
      c.color_id,
      c.color_name,
      c.color_hex,
      c.color_priority,
      vp.variant_product_slug,
      vp.variant_product_quantity,
      vp.variant_product_price,
      vp.variant_product_price_sale,
      vp.variant_product_list_image

      FROM variant_product vp
      JOIN color c ON vp.color_id = c.color_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = ? AND c.color_id = ?
      `,
      [productSlug, colorId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Không tìm thấy biến thể phù hợp" });
    }

    const data = rows[0];

    return res.json({
      variantId: data.variant_id,
      productId: data.product_id,
      colorId: data.color_id,
      colorName: data.color_name,
      colorHex: data.color_hex,
      colorPriority: data.color_priority,
      quantity: data.variant_product_quantity,
      price: data.variant_product_price,
      priceSale: data.variant_product_price_sale,
      slug: data.variant_product_slug,
      listImage: data.variant_product_list_image,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi khi lấy chi tiết biến thể" });
  }
});

/**
 * @route   POST /api/variants
 * @desc    Tạo biến thể mới
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      product_id,
      variant_colors,
      variant_materials,
      variant_width,
      variant_height,
      variant_depth,
      list_img,
    } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    // Kiểm tra sản phẩm tồn tại
    const [product] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [product_id]
    );
    if (product.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const [result] = await db.query(
      "INSERT INTO variant_product (product_id, variant_colors, variant_materials, variant_width, variant_height, variant_depth, list_img) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        product_id,
        variant_colors || null,
        variant_materials || null,
        variant_width || null,
        variant_height || null,
        variant_depth || null,
        list_img || null,
      ]
    );

    const [newVariant] = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = ?",
      [result.insertId]
    );

    res.status(201).json({
      message: "Variant created successfully",
      variant: newVariant[0],
    });
  } catch (error) {
    console.error("Error creating variant:", error);
    res.status(500).json({ error: "Failed to create variant" });
  }
});

/* * @route   POST /api/variants/:productId
 * @desc    Tạo biến thể mới cho sản phẩm
 * @access  Private (Admin only)
 */

/**
 * @route   POST /api/variants/:productId
 * @desc    Tạo biến thể mới cho sản phẩm (nhận JSON, list_image là mảng URL)
 * @access  Private (Admin only)
 */

router.post("/:productId", async (req, res) => {
  const productId = req.params.productId;
  const { color_id, slug, quantity, price, price_sale, list_image } = req.body;

  if (!productId) return res.status(400).json({ error: "Thiếu productId" });

  try {
    // Kiểm tra sản phẩm tồn tại
    const [product] = await db.query(
      "SELECT product_id FROM product WHERE product_id = ?",
      [productId]
    );
    if (product.length === 0) {
      return res.status(404).json({ error: "Product không tồn tại" });
    }

    // Xử lý list_image (mảng hoặc chuỗi)
    let listImageStr = formatImageList(list_image);
    if (!listImageStr) listImageStr = ""; // Đảm bảo luôn là chuỗi, không null

    // Insert vào DB
    const [result] = await db.query(
      `INSERT INTO variant_product (
        product_id,
        color_id,
        variant_product_slug,
        variant_product_quantity,
        variant_product_price,
        variant_product_price_sale,
        variant_product_list_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        color_id || null,
        slug || null,
        quantity || null,
        price || null,
        price_sale || null,
        listImageStr,
      ]
    );

    res.status(201).json({
      message: "Tạo biến thể thành công",
      variant_id: result.insertId,
      list_image: list_image,
    });
  } catch (error) {
    console.error("[POST VARIANT] Lỗi:", error);
    res
      .status(500)
      .json({ error: "Tạo biến thể thất bại", detail: error.message });
  }
});

/**
 * @route   PUT /api/variants/:variantId
 * @desc    Cập nhật thông tin biến thể
 * @access  Private (Admin only)
 */
router.put("/:variantId", async (req, res) => {
  const variantId = req.params.variantId;
  let { color_id, slug, quantity, price, price_sale, list_image } = req.body;

  // Đảm bảo list_image là chuỗi
  const listImageStr = formatImageList(list_image);

  if (!variantId) {
    return res.status(400).json({ error: "Variant ID is required" });
  }

  // Kiểm tra biến thể tồn tại
  const [existingVariant] = await db.query(
    "SELECT variant_id FROM variant_product WHERE variant_id = ?",
    [variantId]
  );
  if (existingVariant.length === 0) {
    return res.status(404).json({ error: "Variant not found" });
  }

  await db.query(
    `
    UPDATE variant_product SET
      color_id = COALESCE(?, color_id),
      variant_product_slug = COALESCE(?, variant_product_slug),
      variant_product_quantity = COALESCE(?, variant_product_quantity),
      variant_product_price = COALESCE(?, variant_product_price),
      variant_product_price_sale = COALESCE(?, variant_product_price_sale),
      variant_product_list_image = COALESCE(?, variant_product_list_image)
    WHERE variant_id = ?
  `,
    [
      color_id || null,
      slug || null,
      quantity || null,
      price || null,
      price_sale || null,
      listImageStr, // Đảm bảo là chuỗi
      variantId,
    ]
  );

  const [updatedVariant] = await db.query(
    "SELECT * FROM variant_product WHERE variant_id = ?",
    [variantId]
  );

  res.json({
    message: "Variant updated successfully",
    variant: updatedVariant[0],
  });
});

/**
 * @route   DELETE /api/variants/:variantId
 * @desc    Xóa biến thể
 * @access  Private (Admin only)
 */
router.delete("/:variantId", async (req, res) => {
  const { variantId } = req.params;

  if (!variantId) {
    return res.status(400).json({ error: "Thiếu variantId" });
  }

  // 🟢 Đặt hàm này ngay đầu trước khi sử dụng nó
  const extractPublicIdFromUrl = (url) => {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;

    const pathParts = parts[1].split("/");
    if (pathParts[0].startsWith("v") && !isNaN(pathParts[0].substring(1))) {
      pathParts.shift();
    }

    const fullPath = pathParts.join("/");
    return fullPath.replace(/\.(jpg|jpeg|png|webp|gif)$/, "");
  };

  try {
    // 1. Kiểm tra biến thể tồn tại
    const [existingVariant] = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = ?",
      [variantId]
    );
    if (existingVariant.length === 0) {
      return res.status(404).json({ error: "Biến thể không tồn tại" });
    }

    // 2. Check có trong đơn hàng không
    const [orderItems] = await db.query(
      "SELECT * FROM order_items WHERE variant_id = ? LIMIT 1",
      [variantId]
    );
    if (orderItems.length > 0) {
      return res.status(400).json({
        error: "Không thể xoá biến thể đang được sử dụng trong đơn hàng",
      });
    }

    // 3. Tách ảnh từ list_image
    const listImageStr = existingVariant[0].variant_product_list_image || "";

    const imageUrls = listImageStr
      .split(",")
      .filter((url) => url.trim() !== "");

    const publicIds = imageUrls
      .map((url) => {
        try {
          return extractPublicIdFromUrl(url);
        } catch (err) {
          console.warn("Lỗi extract URL:", url);
          return null;
        }
      })
      .filter(Boolean);

    // 4. Xoá ảnh khỏi Cloudinary
    await Promise.all(
      publicIds.map(async (id) => {
        try {
          const result = await cloudinary.uploader.destroy(id);
          console.log("🗑️ Đã xoá ảnh:", id, result);
          return result;
        } catch (err) {
          console.warn("❌ Không thể xoá ảnh:", id, err.message);
          return null;
        }
      })
    );
    console.log("🗑️ Đã xoá ảnh khỏi Cloudinary:", publicIds);

    // 5. Xoá biến thể
    await db.query("DELETE FROM variant_product WHERE variant_id = ?", [
      variantId,
    ]);

    res.json({
      message: "Đã xoá biến thể và ảnh thành công",
      deletedImages: publicIds,
    });
  } catch (error) {
    console.error("❌ Lỗi khi xoá biến thể:", error);
    res.status(500).json({
      error: "Lỗi server khi xoá biến thể",
      detail: error.message,
    });
  }
});

/**
 * @route   GET /api/variants/by-product/:slug
 * @desc    Lấy danh sách biến thể theo sản phẩm
 * @access  Public
 */
// GET /api/variants/by-product/:slug
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ error: "Missing product slug" });
  try {
    const [rows] = await db.query(
      `
      SELECT vp.*
      FROM variant_product vp
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = ?
    `,
      [slug]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch variants by product" });
  }
});
module.exports = router;
