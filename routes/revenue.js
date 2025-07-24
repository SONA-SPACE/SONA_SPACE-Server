const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");

// các end point liên quan đến doanh thu
// 1. GET /api/revenue → trả về 7 ngày gần nhất
// 2. GET /api/revenue?type=day&limit=10 → 10 ngày gần nhất
// 3. Theo tháng:
// GET /api/revenue?type=month → 12 tháng mới nhất
// GET /api/revenue?type=month&limit=6 → 6 tháng mới nhất
// 4. Theo năm:
// GET /api/revenue?type=year → 5 năm mới nhất
// GET /api/revenue?type=year&limit=3 → 3 năm mới nhất
const dayjs = require("dayjs");

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { type = "day", from, to, limit } = req.query;
    let dateList = [];
    let dateFormat, limitNum;

    // 1. Xác định format và số lượng mốc thời gian
    if (type === "month") {
      dateFormat = "%Y-%m";
      limitNum = Number(limit) || 12;
    } else if (type === "year") {
      dateFormat = "%Y";
      limitNum = Number(limit) || 5;
    } else {
      dateFormat = "%Y-%m-%d";
      limitNum = Number(limit) || 7;
    }

    // 2. Nếu có from/to: vẫn cho filter như cũ
    if (from && to) {
      // Sinh dải ngày/tháng/năm từ from → to
      let start = dayjs(from);
      let end = dayjs(to);
      while (
        start.isBefore(end) ||
        start.isSame(end, type === "day" ? "day" : type)
      ) {
        if (type === "day") {
          dateList.push(start.format("YYYY-MM-DD"));
          start = start.add(1, "day");
        } else if (type === "month") {
          dateList.push(start.format("YYYY-MM"));
          start = start.add(1, "month");
        } else if (type === "year") {
          dateList.push(start.format("YYYY"));
          start = start.add(1, "year");
        }
      }
    } else {
      // 3. Luôn dùng ngày hiện tại của hệ thống (today)
      const today = dayjs();
      if (type === "day") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "day").format("YYYY-MM-DD"));
        }
      } else if (type === "month") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "month").format("YYYY-MM"));
        }
      } else if (type === "year") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "year").format("YYYY"));
        }
      }
    }

    // 4. Truy vấn và mapping giữ nguyên
    // Orders
    const [orders] = await db.query(
      `
      SELECT DATE_FORMAT(created_at, ?) AS date, SUM(order_total_final) AS revenue
      FROM orders
      WHERE current_status = 'SUCCESS' AND DATE_FORMAT(created_at, ?) IN (?)
      GROUP BY DATE_FORMAT(created_at, ?)
      `,
      [dateFormat, dateFormat, dateList, dateFormat]
    );
    // Design contacts
    const [designContacts] = await db.query(
      `
      SELECT DATE_FORMAT(created_at, ?) AS date, SUM(design_fee) AS revenue
      FROM contact_form_design
      WHERE status = 'RESOLVED' AND DATE_FORMAT(created_at, ?) IN (?)
      GROUP BY DATE_FORMAT(created_at, ?)
      `,
      [dateFormat, dateFormat, dateList, dateFormat]
    );

    // Map kết quả vào dải ngày liên tục (ngày nào không có revenue thì để 0)
    const resultMap = {};
    dateList.forEach((date) => {
      resultMap[date] = { date, orderRevenue: 0, designRevenue: 0 };
    });
    orders.forEach((row) => {
      if (resultMap[row.date])
        resultMap[row.date].orderRevenue = Number(row.revenue) || 0;
    });
    designContacts.forEach((row) => {
      if (resultMap[row.date])
        resultMap[row.date].designRevenue = Number(row.revenue) || 0;
    });
    const result = dateList.map((date) => resultMap[date]);

    res.json(result);
  } catch (error) {
    console.error("Error fetching revenue:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Lấy tổng số người dùng
// GET /user?type=day (hoặc không truyền): trả về số user mới từng ngày (7 ngày gần nhất)
// GET /user?type=month: trả về số user mới từng tháng (12 tháng gần nhất)
// GET /user?type=year: trả về số user mới từng năm (5 năm gần nhất)
router.get("/user", verifyToken, isAdmin, async (req, res) => {
  try {
    const { type = "day", from, to, limit } = req.query;
    let dateFormat,
      limitNum,
      dateList = [];

    // 1. Xác định định dạng và số lượng
    if (type === "month") {
      dateFormat = "%Y-%m";
      limitNum = Number(limit) || 12;
    } else if (type === "year") {
      dateFormat = "%Y";
      limitNum = Number(limit) || 5;
    } else {
      dateFormat = "%Y-%m-%d";
      limitNum = Number(limit) || 7;
    }

    // 2. Nếu truyền from/to thì query theo khoảng thời gian
    if (from && to) {
      // Sinh dải ngày/tháng/năm từ from đến to
      let start = dayjs(from);
      let end = dayjs(to);
      while (
        start.isBefore(end) ||
        start.isSame(end, type === "day" ? "day" : type)
      ) {
        if (type === "day") {
          dateList.push(start.format("YYYY-MM-DD"));
          start = start.add(1, "day");
        } else if (type === "month") {
          dateList.push(start.format("YYYY-MM"));
          start = start.add(1, "month");
        } else if (type === "year") {
          dateList.push(start.format("YYYY"));
          start = start.add(1, "year");
        }
      }
    } else {
      // 3. Không có from/to: dùng ngày hiện tại (today)
      const today = dayjs();
      if (type === "day") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "day").format("YYYY-MM-DD"));
        }
      } else if (type === "month") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "month").format("YYYY-MM"));
        }
      } else if (type === "year") {
        for (let i = limitNum - 1; i >= 0; i--) {
          dateList.push(today.subtract(i, "year").format("YYYY"));
        }
      }
    }

    // 4. Query số user group theo mốc thời gian
    const [userCounts] = await db.query(
      `
      SELECT DATE_FORMAT(created_at, ?) AS date, COUNT(*) AS total
      FROM user
      WHERE DATE_FORMAT(created_at, ?) IN (?)
      GROUP BY DATE_FORMAT(created_at, ?)
      `,
      [dateFormat, dateFormat, dateList, dateFormat]
    );

    // 5. Map vào dải ngày liên tục, đảm bảo đủ mốc thời gian, nếu không có user thì trả về 0
    const resultMap = {};
    dateList.forEach((date) => {
      resultMap[date] = { date, userCount: 0 };
    });
    userCounts.forEach((row) => {
      if (resultMap[row.date])
        resultMap[row.date].userCount = Number(row.total) || 0;
    });

    const result = dateList.map((date) => resultMap[date]);
    res.json(result);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
