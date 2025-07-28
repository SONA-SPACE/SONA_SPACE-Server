require("dotenv").config();
const jwt = require("jsonwebtoken");
const db = require("../config/database");

// Lấy JWT secret từ biến môi trường hoặc sử dụng giá trị mặc định
const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";

/**
 * Middleware xác thực JWT token
 */
exports.verifyToken = async (req, res, next) => {
  try {
    console.log('🔍 verifyToken: Bắt đầu xác thực token cho:', req.path);
    
    // Lấy token từ header Authorization hoặc cookie
    let token;

    // Thử lấy từ header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
      console.log('🔍 Token từ header:', token?.substring(0, 20) + '...');
    }

    // Nếu không có trong header, thử lấy từ cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔍 Token từ cookie:', token?.substring(0, 20) + '...');
    }

    // Nếu không tìm thấy token
    if (!token) {
      console.log('❌ Không tìm thấy token');
      // Nếu là API request, trả về JSON error
      if (req.path.startsWith("/api/")) {
        return res
          .status(401)
          .json({ error: "Không được phép - Không có token" });
      }
      // Nếu là web request, chuyển hướng về trang đăng nhập
      if (typeof next === "function") {
        return next(new Error("Không có token"));
      } else {
        return res.redirect("/");
      }
    }

    console.log('🔍 Đang verify token với JWT_SECRET...');
    // Xác minh token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decoded:', { id: decoded.id, role: decoded.role });

    // Hỗ trợ cả format cũ (userId) và mới (id)
    const userId = decoded.id || decoded.userId;

    // Nếu token có role, lưu lại
    const tokenRole = decoded.role;

    if (!userId) {
      if (req.path.startsWith("/api/")) {
        return res
          .status(401)
          .json({ error: "Không được phép - Token không hợp lệ" });
      }
      if (typeof next === "function") {
        return next(new Error("Token không hợp lệ"));
      } else {
        return res.redirect("/");
      }
    }

    // Kiểm tra xem user có tồn tại trong database
    const [users] = await db.query(
      "SELECT user_id, user_gmail, user_role FROM user WHERE user_id = ?",
      [userId]
    );

    if (!users.length) {
      if (req.path.startsWith("/api/")) {
        return res
          .status(401)
          .json({ error: "Không được phép - User không tồn tại" });
      }
      if (typeof next === "function") {
        return next(new Error("User không tồn tại"));
      } else {
        return res.redirect("/");
      }
    }

    // Lưu thông tin người dùng vào request object
    req.user = {
      id: users[0].user_id,
      email: users[0].user_gmail,
      role: users[0].user_role || tokenRole, // Ưu tiên dùng role từ DB, nếu không có thì dùng từ token
    };

    next();
  } catch (error) {
    console.error("Authentication error details:", {
      name: error.name,
      message: error.message,
      path: req.path,
      token: req.headers.authorization?.substring(0, 20) + '...'
    });

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      if (req.path.startsWith("/api/")) {
        return res
          .status(401)
          .json({ error: { message: "Token không hợp lệ", status: 401 } });
      }
      if (typeof next === "function") {
        return next(new Error("Token không hợp lệ"));
      } else {
        return res.redirect("/");
      }
    }

    console.error("Authentication error:", error);

    if (req.path.startsWith("/api/")) {
      return res.status(500).json({ error: { message: "Token không hợp lệ", status: 500 } });
    }
    if (typeof next === "function") {
      return next(error);
    } else {
      return res.redirect("/");
    }
  }
};

/**
 * Middleware kiểm tra quyền admin
 */
exports.isAdmin = async (req, res, next) => {
  try {
    console.log("Checking admin role. Token role:", req.user?.role);
    console.log("User object:", JSON.stringify(req.user));

    if (!req.user || !req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden - Admin access required" });
    }

    const [adminCheck] = await db.query(
      "SELECT user_role FROM user WHERE user_id = ?",
      [req.user.id]
    );
    console.log("Admin check from DB:", adminCheck);

    const allowedRoles = ["admin", "staff"];
    if (
      adminCheck.length === 0 ||
      !adminCheck[0].user_role ||
      !allowedRoles.includes(adminCheck[0].user_role.toLowerCase())
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden - Admin or Staff access required" });
    }

    next();
  } catch (error) {
    console.error("Error checking admin role:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Tạo JWT token
 */
exports.generateToken = (userId) => {
  // Cập nhật để sử dụng định dạng mới
  return jwt.sign({ id: userId, role: "user" }, JWT_SECRET, {
    expiresIn: "24h",
  });
};

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Lấy token từ header Authorization nếu có
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // Nếu không có trong header, thử lấy từ cookie (nếu bạn dùng cookie)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    // Nếu không có token, tiếp tục như khách (guest)
    if (!token) return next();

    // Giải mã token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    if (!userId) return next();

    // Kiểm tra user trong database
    const [[user]] = await db.query(
      "SELECT user_id, user_gmail, user_role FROM user WHERE user_id = ?",
      [userId]
    );

    if (user) {
      req.user = {
        id: user.user_id,
        email: user.user_gmail,
        role: user.user_role || decoded.role || "user",
      };
    }

    next();
  } catch (err) {
    console.warn("optionalAuth: token invalid hoặc hết hạn – xử lý như guest");
    next(); // tiếp tục cho dù token lỗi
  }
};
exports.isAdminOnly = async (req, res, next) => {
  if (!req.user || req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({
      error: "Chỉ quản trị viên mới được phép thực hiện hành động này",
    });
  }
  next();
};
