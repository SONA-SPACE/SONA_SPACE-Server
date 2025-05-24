require("dotenv").config();
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Lấy JWT secret từ biến môi trường hoặc sử dụng giá trị mặc định
const JWT_SECRET = process.env.JWT_SECRET || 'furnitown-secret-key';

/**
 * Middleware xác thực JWT token
 */
exports.verifyToken = async (req, res, next) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Xác minh token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Hỗ trợ cả format cũ (userId) và mới (id)
    const userId = decoded.id || decoded.userId;
    
    // Nếu token có role, lưu lại
    const tokenRole = decoded.role;
    console.log('Token decoded:', decoded);
    console.log('User ID from token:', userId);
    console.log('Role from token:', tokenRole);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token format' });
    }
    
    // Kiểm tra xem user có tồn tại trong database
    const [users] = await db.query('SELECT user_id, user_gmail, user_role FROM user WHERE user_id = ?', [userId]);
    
    if (!users.length) {
      return res.status(401).json({ error: 'Unauthorized - User not found' });
    }
    
    // Lưu thông tin người dùng vào request object
    req.user = {
      id: users[0].user_id,
      email: users[0].user_gmail,
      role: users[0].user_role || tokenRole // Ưu tiên dùng role từ DB, nếu không có thì dùng từ token
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

/**
 * Middleware kiểm tra quyền admin
 */
exports.isAdmin = async (req, res, next) => {
  try {
    console.log('Checking admin role. Token role:', req.user?.role);
    console.log('User object:', JSON.stringify(req.user));
    
    if (!req.user || !req.user.id) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    
    // Truy vấn trực tiếp quyền từ database
    const [adminCheck] = await db.query('SELECT user_role FROM user WHERE user_id = ?', [req.user.id]);
    console.log('Admin check from DB:', adminCheck);
    
    // Kiểm tra user_role từ DB
    if (adminCheck.length === 0 || 
        (!adminCheck[0].user_role || 
         adminCheck[0].user_role.toLowerCase() !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Tạo JWT token
 */
exports.generateToken = (userId) => {
  // Cập nhật để sử dụng định dạng mới
  return jwt.sign({ id: userId, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
};
