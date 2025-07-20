const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { sendEmail } = require("../services/mailService");

/**
 * @route   POST /api/contact-forms
 * @desc    Gửi form liên hệ
 * @access  Public
 */
router.post("/", async (req, res) => {
  try {
    const {
      contact_form_design_id,
      name,
      email,
      phone,
      room_name,
      design_description,
      require_design,
      style_design,
      budget,
      different_information,
      design_fee,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !email || !design_description) {
      return res
        .status(400)
        .json({ error: "Name, email, and design description are required" });
    }

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Kiểm tra form trùng lặp ( email, phone, name ) Nếu form này đã được xử lý thì sẽ được gửi lại
    const [checkDuplicate] = await db.query(
      `SELECT * FROM contact_form_design
       WHERE status IN ('NEW', 'PENDING', 'IN_PROGRESS')
       AND created_at > NOW() - INTERVAL 1 DAY
       AND (email = ? OR phone = ? OR name = ?)`,
      [email, phone, name]
    );

    if (checkDuplicate.length > 0) {
      return res
        .status(400)
        .json({ error: "Đang có form đang xử lý với thông tin trùng lặp" });
    }

    // Lưu form liên hệ vào database Mặc định default sẽ là PENDING
    const [result] = await db.query(
      `
      INSERT INTO contact_form_design (
        contact_form_design_id,
        name,
        email,
        phone,
        room_name,
        design_description,
        require_design,
        style_design,
        budget,
        different_information,
        design_fee,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
      [
        contact_form_design_id || null,
        name,
        email,
        phone || null,
        room_name || null,
        design_description,
        require_design || null,
        style_design || null,
        budget || null,
        different_information || null,
        design_fee || null,
      ]
    );

    const data = {
      name,
      email,
      phone,
      room_name,
      design_description,
      require_design,
      style_design,
      budget,
      different_information,
    };

    sendEmail(data.email, "Xác nhận Yêu cầu Tư vấn Thiết kế", data);
    res.status(200).json({
      data,
      success: true,
      message: "Gửi yêu cầu thành công",
      contactId: result.insertId,
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gửi yêu cầu thất bại",
    });
  }
});

/**
 * @route   GET /api/contact-forms
 * @desc    Lấy danh sách các form liên hệ
 * @access  Private (Admin only)
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Lọc theo trạng thái nếu có
    const statusFilter = req.query.status
      ? `WHERE status = '${req.query.status}'`
      : "";

    // Đếm tổng số form liên hệ
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total 
      FROM contact_form_design
      ${statusFilter}
    `);

    const totalForms = countResult[0].total;
    const totalPages = Math.ceil(totalForms / limit);

    // Lấy danh sách form liên hệ
    const [forms] = await db.query(
      `
      SELECT 
        contact_form_design.contact_form_design_id,
        contact_form_design.name,
        contact_form_design.email,
        contact_form_design.phone,
        contact_form_design.room_name,
        contact_form_design.require_design,
        contact_form_design.style_design,
        contact_form_design.budget,
        contact_form_design.design_fee,
        contact_form_design.status,
        contact_form_design.created_at,
        contact_form_design.updated_at,
        u.user_name as servicer_name
      FROM contact_form_design
      ${statusFilter}
      LEFT JOIN user u ON u.user_id = contact_form_design.user_id
      ORDER BY created_at DESC
      LIMIT ?, ?
    `,
      [offset, limit]
    );

    res.json({
      forms,
      pagination: {
        currentPage: page,
        totalPages,
        totalForms,
        formsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching contact forms:", error);
    res.status(500).json({ error: "Failed to fetch contact forms" });
  }
});

/**
 * @route   GET /api/contact-forms/:id
 * @desc    Lấy chi tiết một form liên hệ
 * @access  Private (Admin only)
 */
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const [forms] = await db.query(
      `SELECT 
        contact_form_design.*,
        u.user_name as staff_name
      FROM contact_form_design
      LEFT JOIN user u ON u.user_id = contact_form_design.user_id
      WHERE contact_form_design.contact_form_design_id = ?`,
      [id]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    res.json(forms[0]);
  } catch (error) {
    console.error("Error fetching contact form:", error);
    res.status(500).json({ error: "Failed to fetch contact form" });
  }
});

/**
 * @route   PUT /api/contact-forms/:id
 * @desc    Cập nhật trạng thái form liên hệ
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const { status, remarks, ...rest } = req.body;
    const editableFields = [
      "name",
      "email",
      "phone",
      "room_name",
      "design_description",
      "require_design",
      "style_design",
      "budget",
      "different_information",
      "design_fee",
      "user_id",
      "remarks",
      "drive",
    ];

    // Kiểm tra form tồn tại
    const [forms] = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = ?",
      [id]
    );
    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    // Kiểm tra trạng thái hợp lệ
    if (status !== undefined && status !== null && status !== "") {
      const [statusEnumRows] = await db.query(`
        SHOW COLUMNS FROM contact_form_design LIKE 'status'
      `);
      const statusEnumStr = statusEnumRows[0].Type.match(/enum\((.*)\)/)[1];
      const validStatuses = statusEnumStr
        .split(",")
        .map((s) => s.replace(/'/g, "").trim());

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Trạng thái không hợp lệ" });
      }
      // Kiểm tra chuyển trạng thái hợp lệ
      const currentStatus = forms[0].status;
      const validTransitions = {
        PENDING: ["IN_PROGRESS"],
        IN_PROGRESS: ["RESOLVED", "REJECTED"],
        RESOLVED: ["CLOSED"],
        REJECTED: ["CLOSED"],
        CLOSED: [],
      };
      if (status === "IN_PROGRESS" && forms[0].user_id === null) {
        return res
          .status(400)
          .json({
            error:
              "Vui lòng chọn nhân viên thực hiện trước khi chuyển trạng thái",
          });
      }
      if (
        status !== currentStatus &&
        !validTransitions[currentStatus].includes(status)
      ) {
        return res
          .status(400)
          .json({ error: "Trạng thái không được phép chuyển đổi" });
      }
    }

    // kiểm tra budget và design_fee
    const { budget, design_fee } = rest;
    if (budget !== undefined && isNaN(budget)) {
      return res.status(400).json({ error: "Budget phải là số" });
    }
    if (design_fee !== undefined && isNaN(design_fee)) {
      return res.status(400).json({ error: "Design_fee phải là số" });
    }

    // Cập nhật form
    const updates = [];
    const values = [];

    // Duyệt qua các trường được phép update
    for (const key of editableFields) {
      if (rest[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(rest[key]);
      }
    }

    // Thêm status nếu có truyền lên
    if (status !== undefined && status !== null && status !== "") {
      updates.push("status = ?");
      values.push(status);
    }

    if (remarks !== undefined) {
      updates.push("remarks = ?");
      values.push(remarks);
    }

    // Luôn cập nhật updated_at
    updates.push("updated_at = NOW()");

    if (updates.length === 1 && updates[0] === "updated_at = NOW()") {
      return res.status(400).json({ error: "Không có dữ liệu cập nhật" });
    }

    values.push(id);

    await db.query(
      `UPDATE contact_form_design SET ${updates.join(
        ", "
      )} WHERE contact_form_design_id = ?`,
      values
    );

    const [updatedForm] = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = ?",
      [id]
    );

    res.json({
      message: "Contact form updated successfully",
      form: updatedForm[0],
    });
  } catch (error) {
    console.error("Error updating contact form:", error);
    res.status(500).json({ error: "Failed to update contact form" });
  }
});

/**
 * @route   GET /api/contact-form-design/:id/details
 * @desc    Lấy danh sách sản phẩm trong chi tiết thiết kế
 * @access  Private (Admin only)
 */
router.get("/:id/details", verifyToken, isAdmin, async (req, res) => {
  try {
    const contact_form_design_id = Number(req.params.id);
    if (isNaN(contact_form_design_id)) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const [details] = await db.query(
      `SELECT
                d.*,
                v.variant_product_price,
                v.variant_product_list_image,
                v.color_id,
                c.color_hex,
                c.color_name,
                p.product_name as product_name
             FROM contact_form_design_details d
             JOIN variant_product v ON d.variant_id = v.variant_id
             JOIN color c ON v.color_id = c.color_id
             JOIN product p ON v.product_id = p.product_id
             WHERE d.contact_form_design_id = ?`,
      [contact_form_design_id]
    );

    const result = details.map((item) => {
      let first_image = null;
      if (item.variant_product_list_image) {
        first_image = item.variant_product_list_image
          .split(",")
          .map((img) => img.trim().replace(/^['"]+|['"]+$/g, ""))
          .find((img) => img); // Lấy phần tử đầu tiên KHÔNG rỗng
      }

      const { variant_product_list_image, ...rest } = item;
      return {
        ...rest,
        first_image: first_image || null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching design details:", error);
    res.status(500).json({ error: "Failed to fetch design details" });
  }
});

/**
 * @route   POST /api/contact-form-design/:id/details
 * @desc    Thêm sản phẩm vào chi tiết thiết kế
 * @access  Private (Admin only)
 */
router.post("/:id/details", verifyToken, isAdmin, async (req, res) => {
  try {
    const contact_form_design_id = Number(req.params.id);
    if (isNaN(contact_form_design_id)) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    let { variant_id, quantity, unit_price } = req.body;

    // Ép kiểu đúng
    variant_id = Number(variant_id);
    quantity = Number(quantity);
    unit_price = Number(unit_price);

    if (!variant_id || !quantity || !unit_price) {
      return res.status(400).json({
        error:
          "variant_id, quantity, and unit_price are required and must be number",
      });
    }

    // Check if contact form exists
    const [forms] = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = ?",
      [contact_form_design_id]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    // Check if variant exists
    const [variants] = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = ?",
      [variant_id]
    );
    if (variants.length === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    // check if variant is already in the design
    const [existingVariant] = await db.query(
      "SELECT * FROM contact_form_design_details WHERE contact_form_design_id = ? AND variant_id = ?",
      [contact_form_design_id, variant_id]
    );
    if (existingVariant.length > 0) {
      const oldQuantity = Number(existingVariant[0].quantity);
      const newQuantity = oldQuantity + quantity;
      const newTotalPrice = newQuantity * unit_price;
      await db.query(
        `UPDATE contact_form_design_details 
         SET quantity = ?, unit_price = ?, total_price = ?, updated_at = NOW() 
         WHERE contact_form_design_id = ? AND variant_id = ?`,
        [
          newQuantity,
          unit_price,
          newTotalPrice,
          contact_form_design_id,
          variant_id,
        ]
      );

      return res.status(200).json({
        message: "Đã cập nhật số lượng sản phẩm trong form thiết kế.",
        variant_id,
        quantity: newQuantity,
        total_price: newTotalPrice,
      });
    }

    const total_price = quantity * unit_price;

    // Insert chi tiết vào bảng
    const [result] = await db.query(
      `INSERT INTO contact_form_design_details (
        contact_form_design_id, 
        variant_id, 
        quantity, 
        unit_price, 
        total_price,
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [contact_form_design_id, variant_id, quantity, unit_price, total_price]
    );
    // Optionally trả về chi tiết đã thêm
    res.status(201).json({
      message: "Product variant added to design successfully",
      detailId: result.insertId,
      variant_id,
      quantity,
      total_price,
    });
  } catch (error) {
    console.error("Error adding product variant to design:", error);
    res.status(500).json({ error: "Failed to add product variant to design" });
  }
});

/**
 * @route   PUT /api/contact-form-design/:id/details/:detail_id
 * @desc    Cập nhật sản phẩm trong chi tiết thiết kế
 * @access  Private (Admin only)
 */
router.put(
  "/:id/details/:variant_id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id, variant_id } = req.params;
      const contact_form_design_id = Number(id);
      const variantId = Number(variant_id);

      if (isNaN(contact_form_design_id) || isNaN(variantId)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      let { quantity, unit_price } = req.body;

      // Lấy thông tin chi tiết hiện tại (dựa vào contact_form_design_id và variant_id)
      const [details] = await db.query(
        "SELECT * FROM contact_form_design_details WHERE contact_form_design_id = ? AND variant_id = ?",
        [contact_form_design_id, variantId]
      );

      if (details.length === 0) {
        return res.status(404).json({
          error: "Detail item not found or does not belong to this design",
        });
      }
      const currentDetail = details[0];

      // Nếu FE không truyền thì lấy giá trị cũ
      quantity =
        quantity !== undefined
          ? Number(quantity)
          : Number(currentDetail.quantity);
      unit_price =
        unit_price !== undefined
          ? Number(unit_price)
          : Number(currentDetail.unit_price);

      if (quantity <= 0 || unit_price <= 0) {
        return res
          .status(400)
          .json({ error: "quantity and unit_price must be positive numbers" });
      }

      const total_price = quantity * unit_price;

      const [result] = await db.query(
        `UPDATE contact_form_design_details 
             SET quantity = ?, unit_price = ?, total_price = ?, updated_at = NOW()
             WHERE contact_form_design_id = ? AND variant_id = ?`,
        [quantity, unit_price, total_price, contact_form_design_id, variantId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Detail item not found" });
      }

      // Trả về detail mới (cập nhật xong)
      res.json({
        message: "Design detail updated successfully",
        detail: {
          contact_form_design_id,
          variant_id: variantId,
          quantity,
          unit_price,
          total_price,
        },
      });
    } catch (error) {
      console.error("Error updating design detail:", error);
      res.status(500).json({ error: "Failed to update design detail" });
    }
  }
);

/**
 * @route   DELETE /api/contact-form-design/:id/details/:variant_id
 * @desc    Xóa sản phẩm khỏi chi tiết thiết kế
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/details/:variant_id",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const { id, variant_id } = req.params;
      const contact_form_design_id = Number(id);
      const variantId = Number(variant_id);

      if (isNaN(contact_form_design_id) || isNaN(variantId)) {
        return res.status(400).json({ error: "Invalid ID" });
      }

      const [result] = await db.query(
        "DELETE FROM contact_form_design_details WHERE contact_form_design_id = ? AND variant_id = ?",
        [contact_form_design_id, variantId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Sản phẩm không tồn tại trong form thiết kế",
        });
      }

      res.json({ message: "Sản phẩm đã được xóa khỏi form thiết kế" });
    } catch (error) {
      console.error("Error removing product variant from design:", error);
      res
        .status(500)
        .json({ error: "Không thể xóa sản phẩm khỏi form thiết kế" });
    }
  }
);

/**
 * @route   DELETE /api/contact-forms/:id
 * @desc    Xóa form liên hệ
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID contact form không hợp lệ" });
    }

    // Kiểm tra form tồn tại
    const [forms] = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = ?",
      [id]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: "Form liên hệ không tồn tại" });
    }

    //  Xóa liên kết với bảng contact_form_design_details
    await db.query(
      "DELETE FROM contact_form_design_details WHERE contact_form_design_id = ?",
      [id]
    );

    // Xóa form
    await db.query(
      "DELETE FROM contact_form_design WHERE contact_form_design_id = ?",
      [id]
    );

    res.json({ message: "Form liên hệ đã được xóa thành công" });
  } catch (error) {
    console.error("Error deleting contact form:", error);
    res.status(500).json({ error: "Không thể xóa form liên hệ" });
  }
});

module.exports = router;
