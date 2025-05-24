const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   POST /api/contact-forms
 * @desc    Gửi form liên hệ
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    // Kiểm tra các trường bắt buộc
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    
    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Lưu form liên hệ vào database
    const [result] = await db.query(`
      INSERT INTO contact_form (name, email, phone, subject, message, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [name, email, phone || null, subject || null, message]);
    
    res.status(201).json({
      message: 'Contact form submitted successfully',
      contactId: result.insertId
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

/**
 * @route   GET /api/contact-forms
 * @desc    Lấy danh sách các form liên hệ
 * @access  Private (Admin only)
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Lọc theo trạng thái nếu có
    const statusFilter = req.query.status ? `WHERE status = '${req.query.status}'` : '';
    
    // Đếm tổng số form liên hệ
    const [countResult] = await db.query(`
      SELECT COUNT(*) as total 
      FROM contact_form
      ${statusFilter}
    `);
    
    const totalForms = countResult[0].total;
    const totalPages = Math.ceil(totalForms / limit);
    
    // Lấy danh sách form liên hệ
    const [forms] = await db.query(`
      SELECT * FROM contact_form
      ${statusFilter}
      ORDER BY created_at DESC
      LIMIT ?, ?
    `, [offset, limit]);
    
    res.json({
      forms,
      pagination: {
        currentPage: page,
        totalPages,
        totalForms,
        formsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching contact forms:', error);
    res.status(500).json({ error: 'Failed to fetch contact forms' });
  }
});

/**
 * @route   GET /api/contact-forms/:id
 * @desc    Lấy chi tiết một form liên hệ
 * @access  Private (Admin only)
 */
router.get('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contact form ID' });
    }
    
    const [forms] = await db.query('SELECT * FROM contact_form WHERE id = ?', [id]);
    
    if (forms.length === 0) {
      return res.status(404).json({ error: 'Contact form not found' });
    }
    
    res.json(forms[0]);
  } catch (error) {
    console.error('Error fetching contact form:', error);
    res.status(500).json({ error: 'Failed to fetch contact form' });
  }
});

/**
 * @route   PUT /api/contact-forms/:id
 * @desc    Cập nhật trạng thái form liên hệ
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contact form ID' });
    }
    
    const { status, admin_notes } = req.body;
    
    // Kiểm tra form tồn tại
    const [forms] = await db.query('SELECT * FROM contact_form WHERE id = ?', [id]);
    
    if (forms.length === 0) {
      return res.status(404).json({ error: 'Contact form not found' });
    }
    
    // Kiểm tra trạng thái hợp lệ
    const validStatuses = ['new', 'in_progress', 'completed', 'spam'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }
    
    // Cập nhật form
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    
    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      values.push(admin_notes);
    }
    
    updates.push('updated_at = NOW()');
    
    if (updates.length === 1 && updates[0] === 'updated_at = NOW()') {
      return res.status(400).json({ error: 'No update data provided' });
    }
    
    values.push(id);
    
    await db.query(
      `UPDATE contact_form SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updatedForm] = await db.query('SELECT * FROM contact_form WHERE id = ?', [id]);
    
    res.json({
      message: 'Contact form updated successfully',
      form: updatedForm[0]
    });
  } catch (error) {
    console.error('Error updating contact form:', error);
    res.status(500).json({ error: 'Failed to update contact form' });
  }
});

/**
 * @route   DELETE /api/contact-forms/:id
 * @desc    Xóa form liên hệ
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contact form ID' });
    }
    
    // Kiểm tra form tồn tại
    const [forms] = await db.query('SELECT * FROM contact_form WHERE id = ?', [id]);
    
    if (forms.length === 0) {
      return res.status(404).json({ error: 'Contact form not found' });
    }
    
    // Xóa form
    await db.query('DELETE FROM contact_form WHERE id = ?', [id]);
    
    res.json({ message: 'Contact form deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact form:', error);
    res.status(500).json({ error: 'Failed to delete contact form' });
  }
});

module.exports = router; 