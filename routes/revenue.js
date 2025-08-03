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
require("dayjs/locale/vi");
const dayjs = require("dayjs");
const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
dayjs.extend(isSameOrBefore);

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
      let unit;
      if (type === "day") unit = "day";
      else if (type === "month") unit = "month";
      else unit = "year";
      while (start.isSameOrBefore(end, unit)) {
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
     SELECT 
        DATE_FORMAT(d.created_at, ?) AS date,
        SUM(CASE WHEN d.status = 'RESOLVED' THEN d.design_fee ELSE 0 END) AS design_fee_total,
        SUM(CASE WHEN d.status = 'RESOLVED' THEN IFNULL(dd.products_total, 0) ELSE 0 END) AS products_total,
        SUM(CASE WHEN d.status = 'DEPOSIT' THEN d.design_deposits ELSE 0 END) AS design_deposits_total
      FROM contact_form_design d
      LEFT JOIN (
          SELECT 
            contact_form_design_id, 
            SUM(total_price) AS products_total
          FROM contact_form_design_details
          WHERE deleted_at IS NULL
          GROUP BY contact_form_design_id
      ) dd ON d.contact_form_design_id = dd.contact_form_design_id
      WHERE d.status IN ('RESOLVED', 'DEPOSIT')
        AND DATE_FORMAT(d.created_at, ?) IN (?)
      GROUP BY DATE_FORMAT(d.created_at, ?)
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
      if (resultMap[row.date]) {
        // Cộng luôn 2 khoản vào designRevenue
        const designFee = Number(row.design_fee_total) || 0;
        const productsTotal = Number(row.products_total) || 0;
        const designDeposits = Number(row.design_deposits_total) || 0;
        resultMap[row.date].designRevenue = designFee + productsTotal + designDeposits;
        // resultMap[row.date].depositRevenue = designDeposits; // Tiền cọc chờ xử lý
      }
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

// Node.js/Express (ví dụ)
router.get("/stats", verifyToken, isAdmin, async (req, res) => {
  const currentMonth = dayjs().locale("vi").format("MMMM");
  const fullMonth =
    currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const [[{ totalOrder } = {}]] = await db.query(
    `SELECT COUNT(*) AS totalOrder FROM orders`
  );
  const [[{ completedOrder } = {}]] = await db.query(
    `SELECT COUNT(*) AS completedOrder FROM orders WHERE current_status='SUCCESS'`
  );
  const [[{ shippingOrder } = {}]] = await db.query(
    `SELECT COUNT(*) AS shippingOrder FROM orders WHERE current_status='SHIPPING'`
  );
  const [[{ revenueThisMonth } = {}]] = await db.query(
    `SELECT SUM(order_total_final) AS revenueThisMonth FROM orders WHERE current_status='SUCCESS' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())`
  );
  const [[{ revenueThisMonthDesign } = {}]] = await db.query(
    `SELECT SUM(design_fee + IFNULL(products_total, 0)) AS revenueThisMonthDesign 
    FROM contact_form_design 
    LEFT JOIN (
      SELECT contact_form_design_id, SUM(total_price) AS products_total
      FROM contact_form_design_details
      WHERE deleted_at IS NULL
      GROUP BY contact_form_design_id
    ) dd ON contact_form_design.contact_form_design_id = dd.contact_form_design_id
    WHERE status='RESOLVED' AND MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())`
  );
  const [[{ revenueTotal } = {}]] = await db.query(
    `SELECT SUM(order_total_final) AS revenueTotal FROM orders WHERE current_status='SUCCESS'`
  );
  const [[{ revenueTotalDesign } = {}]] = await db.query(
    `SELECT SUM(design_fee + IFNULL(products_total, 0)) AS revenueTotalDesign 
    FROM contact_form_design 
    LEFT JOIN (
      SELECT contact_form_design_id, SUM(total_price) AS products_total
      FROM contact_form_design_details
      WHERE deleted_at IS NULL
      GROUP BY contact_form_design_id
    ) dd ON contact_form_design.contact_form_design_id = dd.contact_form_design_id
    WHERE status='RESOLVED'`
  );
  res.json({
    totalOrder: Number(totalOrder) || 0,
    completedOrder: Number(completedOrder) || 0,
    shippingOrder: Number(shippingOrder) || 0,
    revenueThisMonth: {
      total: Number(revenueThisMonth) + Number(revenueThisMonthDesign) || 0,
      design: Number(revenueThisMonthDesign) || 0,
    },
    revenueTotal: {
      total: Number(revenueTotal) + Number(revenueTotalDesign) || 0,
      design: Number(revenueTotalDesign) || 0,
    },
    monthName: fullMonth,
  });
});

module.exports = router;
