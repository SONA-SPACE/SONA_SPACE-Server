const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/couponcodes
 * @desc    Lấy danh sách mã giảm giá
 * @access  Private (Admin only)
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const [coupons] = await db.query(`
      SELECT * FROM couponcode
      ORDER BY couponcode_id DESC
    `);

    res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch coupon codes' });
  }
});

router.get('/notification', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        un.id AS user_notification_id,
        un.notification_id,
        n.title,
        n.message,
        n.created_at,
        un.is_read,
        un.read_at
      FROM user_notifications un
      JOIN notifications n ON un.notification_id = n.id
      WHERE un.user_id = ? AND un.is_deleted = 0
      ORDER BY n.created_at DESC
    `, [userId]);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Lỗi lấy thông báo:", error);
    res.status(500).json({ error: "Lỗi server khi lấy thông báo" });
  }
});

router.get('/user-has-coupon', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        uhc.user_id,
        uhc.couponcode_id,
        uhc.status,
        c.code,
        c.title AS discount,
        c.discount_type,
        c.value_price,
        c.exp_time AS validUntil,
        c.start_time AS validFrom,
        c.description,
        c.is_flash_sale AS isFlashSale,
        c.combinations,
        c.min_order
      FROM user_has_coupon uhc
      JOIN couponcode c ON uhc.couponcode_id = c.couponcode_id
      WHERE uhc.user_id = ? 
        AND uhc.status = 0
        AND c.exp_time > NOW()
      ORDER BY c.exp_time ASC
    `, [userId]);

    res.json(rows);
  } catch (error) {
    console.error('Lỗi khi gọi user-has-coupon:', error);
    res.status(500).json({ error: 'Failed to fetch user coupons' });
  }
});




router.get('/codes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        c.couponcode_id,
        c.code, 
        c.title AS discount, 
        c.description,
        c.start_time AS validFrom,
        c.exp_time AS validUntil,
        c.min_order AS minOrder,
        c.used,
        c.status,
        c.is_flash_sale AS isFlashSale,
        c.combinations,
        IF(uhc.user_id IS NOT NULL, 1, 0) AS userUsedStatus
      FROM couponcode c
      LEFT JOIN user_has_coupon uhc 
        ON c.couponcode_id = uhc.couponcode_id AND uhc.user_id = ?
      WHERE 
        c.exp_time > NOW()
        AND c.status != 0
        AND (
          -- Mã dùng chung: không có user nào được gán
          NOT EXISTS (
            SELECT 1 FROM user_has_coupon ch 
            WHERE ch.couponcode_id = c.couponcode_id
          )
          OR
          -- Hoặc user hiện tại được gán
          EXISTS (
            SELECT 1 FROM user_has_coupon ch 
            WHERE ch.couponcode_id = c.couponcode_id AND ch.user_id = ?
          )
        )
      ORDER BY c.exp_time ASC
    `, [userId, userId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

router.get('/admin', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        couponcode_id AS id,
        code, 
        title,
        value_price AS discount, 
        description,
        is_flash_sale AS isFlashSale,
        discount_type,
        start_time,
        used,
        status,
        exp_time
      FROM couponcode
      WHERE exp_time > NOW()
      ORDER BY couponcode_id DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching public coupon codes:', error);
    res.status(500).json({ error: 'Failed to fetch public coupons' });
  }
});

router.get('/userCoupon', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        c.couponcode_id,
        c.code, 
        c.title AS discount, 
        c.description,
        c.start_time AS validFrom,
        c.exp_time AS validUntil,
        c.min_order AS minOrder,
        c.used,
        c.status,
        c.is_flash_sale AS isFlashSale,
        c.combinations,
        1 AS userUsedStatus
      FROM couponcode c
      INNER JOIN user_has_coupon uhc 
        ON c.couponcode_id = uhc.couponcode_id
      WHERE 
        uhc.user_id = ?
        AND c.status != 0
        AND c.exp_time > NOW()
      ORDER BY c.exp_time ASC
    `, [userId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching user vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch user vouchers' });
  }
});

/**
 * @route   GET /api/couponcodes/:id
 * @desc    Lấy thông tin một mã giảm giá
 * @access  Private (Admin only)
 */
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid coupon ID' });

    const [rows] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Coupon code not found' });

    const coupon = rows[0];

    // Kiểm tra nếu voucher được gán cho người dùng mới 30 ngày gần đây
    const [newUserRows] = await db.query(`
      SELECT uhc.user_id
      FROM user_has_coupon uhc
      JOIN user u ON uhc.user_id = u.user_id
      WHERE uhc.couponcode_id = ?
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [id]);

    const [allUserRows] = await db.query(
      'SELECT user_id FROM user_has_coupon WHERE couponcode_id = ?',
      [id]
    );
    const allUserIds = allUserRows.map(row => row.user_id);

    let user_ids = null;

    if (allUserIds.length === 0) {
      user_ids = null; // Áp dụng cho tất cả
    } else if (newUserRows.length === allUserIds.length) {
      user_ids = 'new_users'; // Tất cả user gán đều là user mới (30 ngày)
    } else {
      user_ids = allUserIds;
    }

    res.json({ ...coupon, user_ids });
  } catch (error) {
    console.error('Error fetching coupon code by ID:', error);
    res.status(500).json({ error: 'Failed to fetch coupon code' });
  }
});



/**
 * 
 * @route   POST /api/couponcodes
 * @desc    Tạo mã giảm giá mới
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      is_flash_sale,
      combinations,
      discount_type,
      status,
      user_ids,
    } = req.body;

    if (!code || !title || !value_price || !exp_time || !discount_type || status === undefined) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (used !== undefined && (isNaN(used) || Number(used) <= 0)) {
      return res.status(400).json({ error: 'Lượt sử dụng không hợp lệ' });
    }

    const [exist] = await db.query('SELECT * FROM couponcode WHERE code = ?', [code]);
    if (exist.length > 0) {
      return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
    }

    if (isNaN(value_price) || Number(value_price) <= 0) {
      return res.status(400).json({ error: 'Giá giảm không hợp lệ' });
    }

    const startDate = start_time ? new Date(start_time) : new Date();
    const endDate = new Date(exp_time);
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
    }

    const [result] = await db.query(`
      INSERT INTO couponcode (
        code, title, value_price, description, start_time, exp_time,
        min_order, used, is_flash_sale, combinations, discount_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code, title, value_price, description || null, startDate, endDate,
      min_order || null, used || 1, is_flash_sale || 0, combinations || null,
      discount_type, status
    ]);

    const couponId = result.insertId;

    // Tạo nội dung thông báo
    const [creatorInfo] = await db.query(
      `SELECT user_name, user_role FROM user WHERE user_id = ?`,
      [req.user.id]
    );

    if (!creatorInfo.length) {
      return res.status(400).json({ error: 'Không tìm thấy người tạo' });
    }
    const creator = creatorInfo[0];

    // Lấy id của loại thông báo 'coupon' từ bảng notification_types
    const [typeRows] = await db.query(
      `SELECT id FROM notification_types WHERE type_code = ? AND is_active = 1`,
      ['coupon']
    );

    if (!typeRows.length) {
      return res.status(400).json({ error: 'Loại thông báo không hợp lệ hoặc bị vô hiệu hóa' });
    }

    const notificationTypeId = typeRows[0].id;
    const formatCurrency = (number) => {
      return Number(number).toLocaleString("vi-VN") + "đ";
    };

    const discountValue =
      discount_type === "percentage"
        ? `${value_price}%`
        : formatCurrency(value_price);

    const minOrderValue = min_order
      ? formatCurrency(min_order)
      : formatCurrency(0);
    // Nội dung thông báo
    const notificationTitle = "Bạn nhận được một mã giảm giá mới!";
    const notificationMessage = `Mã ${code} đã được thêm vào tài khoản của bạn.  Bạn được giảm ${discountValue} cho đơn hàng từ ${minOrderValue}. Áp dụng đến ${endDate.toLocaleDateString("vi-VN")}`;

    // Ghi vào bảng notifications
    const [notiResult] = await db.query(`
  INSERT INTO notifications (type_id, title, message, created_by)
  VALUES (?, ?, ?, ?)
`, [
      notificationTypeId,
      notificationTitle,
      notificationMessage,
      `${creator.user_name} (${creator.user_role})`
    ]);

    const notificationId = notiResult.insertId;

    let affectedUsers = [];

    if (user_ids === "new_users") {
      const [newUsers] = await db.query(`
        SELECT user_id FROM user 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      affectedUsers = newUsers.map(user => user.user_id);

    } else if (user_ids === "all") {
      const [allUsers] = await db.query(`SELECT user_id FROM user`);
      affectedUsers = allUsers.map(user => user.user_id);

    } else if (Array.isArray(user_ids) && user_ids.length > 0) {
      affectedUsers = user_ids;
    }

    // Lưu user_has_coupon nếu có user
    if (affectedUsers.length > 0) {
      const couponValues = affectedUsers.map(userId => [userId, couponId]);
      await db.query(`
        INSERT INTO user_has_coupon (user_id, couponcode_id)
        VALUES ?
      `, [couponValues]);

      // Lưu user_notifications
      const notificationValues = affectedUsers.map(userId => [userId, notificationId, 0, null, 0]);
      await db.query(`
        INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
        VALUES ?
      `, [notificationValues]);
    }

    const [newCoupon] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [couponId]);

    res.status(201).json({ message: 'Tạo voucher thành công', coupon: newCoupon[0] });

  } catch (error) {
    console.error('Error creating coupon code:', error);
    res.status(500).json({ error: 'Lỗi khi tạo voucher' });
  }
});


/**
 * @route   PUT /api/couponcodes/:id
 * @desc    Cập nhật mã giảm giá
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID voucher không hợp lệ' });

    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      is_flash_sale,
      combinations,
      discount_type,
      status,
      user_ids,
    } = req.body;

    // Kiểm tra voucher có tồn tại
    const [exist] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'Không tìm thấy voucher' });

    const updates = [];
    const values = [];

    if (code !== undefined) {
      const [duplicate] = await db.query(
        'SELECT * FROM couponcode WHERE code = ? AND couponcode_id != ?',
        [code, id]
      );
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Mã voucher đã tồn tại' });
      }
      updates.push('code = ?');
      values.push(code);
    }

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (value_price !== undefined) {
      if (isNaN(value_price) || Number(value_price) <= 0) {
        return res.status(400).json({ error: 'Giá giảm không hợp lệ' });
      }
      updates.push('value_price = ?');
      values.push(value_price);
    }

    if (start_time !== undefined) {
      updates.push('start_time = ?');
      values.push(new Date(start_time));
    }

    if (exp_time !== undefined) {
      const endDate = new Date(exp_time);
      if (start_time) {
        const startDate = new Date(start_time);
        if (endDate <= startDate) {
          return res.status(400).json({ error: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
        }
      }
      updates.push('exp_time = ?');
      values.push(endDate);
    }

    if (min_order !== undefined) {
      updates.push('min_order = ?');
      values.push(min_order);
    }

    if (used !== undefined) {
      updates.push('used = ?');
      values.push(Number(used));
    }

    if (is_flash_sale !== undefined) {
      updates.push('is_flash_sale = ?');
      values.push(is_flash_sale ? 1 : 0);
    }

    if (combinations !== undefined) {
      updates.push('combinations = ?');
      values.push(combinations);
    }

    if (discount_type !== undefined) {
      if (!['percentage', 'fixed'].includes(discount_type)) {
        return res.status(400).json({ error: 'Kiểu giảm giá không hợp lệ' });
      }
      updates.push('discount_type = ?');
      values.push(discount_type);
    }

    if (status !== undefined) {
      if (![0, 1].includes(Number(status))) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }
      updates.push('status = ?');
      values.push(Number(status));
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'Không có trường nào để cập nhật' });
    }

    values.push(id);
    await db.query(`UPDATE couponcode SET ${updates.join(', ')} WHERE couponcode_id = ?`, values);

    if (user_ids !== undefined) {
      // Xóa hết user cũ
      await db.query('DELETE FROM user_has_coupon WHERE couponcode_id = ?', [id]);

      if (user_ids !== undefined) {
        // Xóa hết user cũ
        await db.query('DELETE FROM user_has_coupon WHERE couponcode_id = ?', [id]);

        if (Array.isArray(user_ids) && user_ids.length > 0) {
          // custom user list
          const insertData = user_ids.map(user_id => [user_id, id, 0]);
          await db.query('INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES ?', [insertData]);
        } else if (user_ids === 'new_users_30d' || user_ids === 'new_users') {
          // Người dùng mới
          const [newUsers] = await db.query(`
      SELECT user_id FROM user 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
          if (newUsers.length > 0) {
            const insertData = newUsers.map(user => [user.user_id, id, 0]);
            await db.query('INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES ?', [insertData]);
          }
        } else if (user_ids === 'all') {
          // Tất cả người dùng
          const [allUsers] = await db.query('SELECT user_id FROM user');
          if (allUsers.length > 0) {
            const insertData = allUsers.map(user => [user.user_id, id, 0]);
            await db.query('INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES ?', [insertData]);
          }
        }
      }

    }


    const [updated] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    res.json({ message: 'Cập nhật voucher thành công', coupon: updated[0] });
  } catch (error) {
    console.error('Error updating coupon code:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi cập nhật voucher' });
  }
});

router.delete('/notification/:id', verifyToken, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'ID thông báo không hợp lệ' });
    }

    const [result] = await db.query(
      `UPDATE user_notifications 
       SET is_deleted = 1 
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy thông báo để xoá' });
    }

    res.json({ message: 'Đã xoá thông báo thành công' });
  } catch (error) {
    console.error('Lỗi khi xoá thông báo:', error);
    res.status(500).json({ error: 'Lỗi server khi xoá thông báo' });
  }
});

// DELETE mã giảm giá
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Mã phiếu giảm giá không hợp lệ' });

    const [exist] = await db.query('SELECT * FROM couponcode WHERE couponcode_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ error: 'Không tìm thấy giảm giá' });

    await db.query('DELETE FROM couponcode WHERE couponcode_id = ?', [id]);
    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    console.error('Error deleting coupon code:', error);
    res.status(500).json({ error: 'Không xóa được mã giảm giá' });
  }
});

/**
 * @route   POST /api/couponcodes/validate
 * @desc    Kiểm tra tính hợp lệ của mã giảm giá
 * @access  Private
 */
router.post('/validate', verifyToken, async (req, res) => {
  try {
    const { code, cart_total } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const [coupons] = await db.query(`
      SELECT * FROM couponcode 
      WHERE code = ? AND used > 0
    `, [code]);

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Voucher không tồn tại hoặc đã hết lượt sử dụng' });
    }

    const coupon = coupons[0];
    const now = new Date();

    //  Check quyền sử dụng (giới hạn theo user hoặc dùng chung)
    const [allowedUsers] = await db.query(
      `SELECT 1 FROM user_has_coupon WHERE couponcode_id = ?`,
      [coupon.couponcode_id]
    );

    const isGlobal = allowedUsers.length === 0; // dùng chung
    if (!isGlobal) {
      const [userAllowed] = await db.query(
        `SELECT 1 FROM user_has_coupon WHERE couponcode_id = ? AND user_id = ?`,
        [coupon.couponcode_id, req.user.id]
      );

      if (userAllowed.length === 0) {
        return res.status(403).json({ error: 'Bạn không có mã giảm giá này' });
      }
    }

    // Thời gian hoạt động
    const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
    if (startTime && startTime > now) {
      return res.status(400).json({ error: 'Voucher chưa hoạt động' });
    }

    const expTime = new Date(coupon.exp_time);
    if (expTime < now) {
      return res.status(400).json({ error: 'Voucher đã hết hạn' });
    }

    // Đơn hàng tối thiểu
    if (coupon.min_order !== null && cart_total < coupon.min_order) {
      return res.status(400).json({
        error: 'Tổng giá trị đơn hàng không đáp ứng yêu cầu mua tối thiểu',
        min_purchase: coupon.min_order
      });
    }

    // Lượt sử dụng của user
    const [usedBefore] = await db.query(
      'SELECT * FROM user_has_coupon WHERE user_id = ? AND couponcode_id = ? AND status = 1',
      [req.user.id, coupon.couponcode_id]
    );

    if (usedBefore.length > 0) {
      return res.status(400).json({ error: 'Bạn đã sử dụng mã giảm giá này rồi' });
    }

    // Tính toán giảm giá
    let discountAmount = 0;
    const value = Number(coupon.value_price);
    if (coupon.discount_type === 'percentage') {
      discountAmount = Math.round((cart_total * value) / 100);
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(cart_total, value);
    }



    res.json({
      valid: true,
      coupon: {
        couponcode_id: coupon.couponcode_id,
        code: coupon.code,
        title: coupon.title,
        value_price: coupon.value_price,
        discount_type: coupon.discount_type,
        discount_amount: discountAmount,
        exp_time: coupon.exp_time,
        description: coupon.description,
        is_flash_sale: !!coupon.is_flash_sale,
        combinations: coupon.combinations,
        min_order: coupon.min_order
      }
    });

  } catch (error) {
    console.error('Error validating coupon code:', error);
    res.status(500).json({ error: 'Failed to validate coupon code' });
  }
});





module.exports = router; 