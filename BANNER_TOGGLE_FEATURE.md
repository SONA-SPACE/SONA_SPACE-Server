# Chức năng Ẩn/Hiện Banner

## ✅ Đã triển khai thành công

### 🔧 **Backend Changes:**

#### 1. **Endpoint mới - Toggle Status:**
```javascript
PUT /api/banners/:id/toggle-status
```
- **Chức năng:** Tự động chuyển đổi trạng thái is_active (1 ↔ 0)
- **Auth:** Yêu cầu Admin token
- **Response:** Trả về banner đã cập nhật và thông báo

#### 2. **Cập nhật GET endpoints:**
```javascript
GET /api/banners
GET /api/banners/page/:pageType
```
- **Thêm alias:** `banner_id as id` để frontend sử dụng
- **Thêm field:** `status` ('active'/'inactive') dựa trên `is_active`

#### 3. **Database Logic:**
```sql
-- is_active = 1 → Hiển thị banner
-- is_active = 0 → Ẩn banner

UPDATE banners SET is_active = ?, updated_at = NOW() WHERE banner_id = ?
```

### 🎨 **Frontend Changes:**

#### 1. **Cập nhật hàm toggle:**
```javascript
// Endpoint mới
PUT /api/banners/${bannerId}/toggle-status

// Không cần body vì tự động toggle
```

#### 2. **UI Status Display:**
```javascript
// Hiển thị
status === 'active' → Badge xanh + Icon eye + "Hiển thị"

// Ẩn  
status === 'inactive' → Badge xám + Icon eye-slash + "Ẩn"
```

#### 3. **Button Logic:**
```javascript
// Nút màu warning (vàng) khi banner đang hiển thị → Click để ẩn
// Nút màu success (xanh) khi banner đang ẩn → Click để hiển thị
```

## 📋 **Cách sử dụng:**

### **Cho Admin:**
1. Vào trang quản lý banner: `/dashboard/banners`
2. Tìm banner cần ẩn/hiện
3. Click nút ẩn/hiện (biểu tượng mắt) bên cạnh banner
4. Trạng thái sẽ thay đổi tức thời và reload danh sách

### **Cho Frontend Public:**
- Chỉ banner có `is_active = 1` mới hiển thị trên trang public
- Banner có `is_active = 0` sẽ bị ẩn hoàn toàn

## 🔍 **API Testing:**

### **Test Toggle Status:**
```bash
curl -X PUT "http://localhost:3501/api/banners/1/toggle-status" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### **Expected Response:**
```json
{
  "message": "Banner đã được hiển thị", // or "đã được ẩn"
  "banner": {
    "banner_id": 1,
    "id": 1,
    "title": "Banner Title",
    "is_active": 1, // or 0
    "status": "active", // or "inactive"
    // ... other fields
  },
  "is_active": 1 // or 0
}
```

## 📊 **Database Schema:**

```sql
-- Bảng banners
CREATE TABLE banners (
  banner_id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),
  image_url VARCHAR(500),
  page_type VARCHAR(50),
  position INT,
  is_active TINYINT(1) DEFAULT 1, -- 1 = hiển thị, 0 = ẩn
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🎯 **Tính năng hoạt động:**

- ✅ Toggle trạng thái banner (ẩn/hiện)
- ✅ Hiển thị status realtime trên UI
- ✅ Phân quyền admin cho chức năng
- ✅ Tự động reload danh sách sau khi thay đổi
- ✅ Toast notification thông báo kết quả
- ✅ Icon và màu sắc thay đổi theo trạng thái
- ✅ Public frontend chỉ hiển thị banner active

## 🔄 **Workflow:**
1. Admin click nút ẩn/hiện
2. Frontend gọi API toggle-status
3. Backend tự động đảo ngược is_active (1→0 hoặc 0→1)
4. Trả về banner đã cập nhật
5. Frontend reload danh sách và hiển thị trạng thái mới
6. Toast thông báo kết quả cho admin

---
**Status:** ✅ Ready for use  
**Date:** August 16, 2025  
**Version:** v1.0
