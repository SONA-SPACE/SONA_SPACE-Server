## LOGIC HOÀN TRẢ THEO YÊU CẦU MỚI 

### 📋 **Tóm tắt Logic Đã Cập Nhật**

Theo yêu cầu của bạn, API return status bây giờ hoạt động như sau:

#### 🔍 **Kiểm tra điều kiện**
1. **API chỉ cho phép thay đổi return status khi `current_status = 'RETURN'`**
2. **Sử dụng `order_id` để tìm và cập nhật bản ghi trong bảng `order_returns`**
3. **Cập nhật cột `status` trong bảng `order_returns`, KHÔNG động vào `current_status` trong bảng `orders`**

#### 🔄 **Quy trình làm việc**

**Backend Logic (routes/orders.js):**
```javascript
// 1. Kiểm tra current_status trong bảng orders
const [[order]] = await db.query(
  "SELECT order_id, order_hash, current_status FROM orders WHERE order_id = ?",
  [orderId]
);

// 2. Chỉ cho phép thay đổi nếu current_status = 'RETURN'
if (order.current_status !== 'RETURN' && return_status !== "") {
  return res.status(400).json({ 
    success: false, 
    message: "Chỉ có thể thay đổi trạng thái hoàn trả khi đơn hàng đang ở trạng thái RETURN" 
  });
}

// 3. Cập nhật status trong bảng order_returns
await connection.query(
  "UPDATE order_returns SET status = ?, updated_at = NOW() WHERE return_id = ?",
  [return_status, existingReturn.return_id]
);
```

**Frontend Logic (orders.ejs):**
```javascript
function mapReturnStatus(order) {
  // Chỉ hiển thị dropdown khi current_status = 'RETURN'
  if (order.current_status !== 'RETURN') {
    return '<span class="badge badge-secondary">Không có hoàn trả</span>';
  }
  
  // Tạo dropdown cho return status management
  return `<select class="return-status-select">...</select>`;
}
```

#### ✅ **Trạng thái đã Test**

**🔒 Bảo mật - Chỉ cho phép khi current_status = 'RETURN':**
```bash
# Test với order có current_status = 'SUCCESS'
PUT /api/orders/318/return-status
Body: {"return_status":"PENDING"}
Result: ❌ {"success":false,"message":"Chỉ có thể thay đổi trạng thái hoàn trả khi đơn hàng đang ở trạng thái RETURN"}
```

**✅ Hoạt động khi current_status = 'RETURN':**
```bash
# Test với order có current_status = 'RETURN'
PUT /api/orders/322/return-status

# Quy trình: PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED
Body: {"return_status":"PENDING"}     → ✅ Success
Body: {"return_status":"APPROVED"}    → ✅ Success  
Body: {"return_status":"CANCEL_CONFIRMED"} → ✅ Success
Body: {"return_status":"CANCELLED"}   → ✅ Success

# Nhánh từ chối: PENDING → REJECTED
Body: {"return_status":"REJECTED"}    → ✅ Success
```

#### 🗃️ **Quản lý dữ liệu**

**Bảng `orders`:**
- `current_status` = `'RETURN'` ➜ Đánh dấu đơn hàng đang trong quy trình hoàn trả
- Không thay đổi `current_status` khi thay đổi return status trong quy trình

**Bảng `order_returns`:**
- `status` = `'PENDING'` ➜ Đang chờ xử lý (1)
- `status` = `'APPROVED'` ➜ Đã duyệt trả hàng (2)  
- `status` = `'CANCEL_CONFIRMED'` ➜ Xác nhận hủy đơn hàng (3)
- `status` = `'CANCELLED'` ➜ Đã hủy hoàn tất (4)
- `status` = `'REJECTED'` ➜ Từ chối trả hàng

#### 🔧 **API Endpoints**

**PUT /api/orders/:id/return-status**
- ✅ Yêu cầu: Admin token
- ✅ Kiểm tra: `current_status = 'RETURN'`
- ✅ Cập nhật: `order_returns.status`
- ✅ Log: Ghi lại thay đổi trạng thái

#### 🎯 **Kết luận**

Logic hiện tại đã hoạt động đúng theo yêu cầu:
1. ✅ **Chỉ cho phép thay đổi return status khi `current_status = 'RETURN'`**
2. ✅ **Sử dụng `order_id` để tìm bản ghi trong `order_returns`**
3. ✅ **Cập nhật cột `status` trong bảng `order_returns`**
4. ✅ **Bảo mật: Từ chối requests không hợp lệ**
5. ✅ **Frontend: Chỉ hiển thị dropdown khi có thể thay đổi**

**🚀 API đã sẵn sàng sử dụng!**
