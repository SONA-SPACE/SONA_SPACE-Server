# Hướng Dẫn Xác Thực (Authentication) API

Tài liệu này hướng dẫn cách thực hiện xác thực để truy cập các API được bảo vệ trong hệ thống.

## 1. Đăng Nhập Để Lấy Token

### Endpoint: `POST /api/auth/login`

Để lấy token xác thực, bạn cần gửi yêu cầu đăng nhập với thông tin tài khoản:

```bash
curl -X POST http://localhost:3501/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "e.hoang@gmail.com", "password": "hashed_password_5"}'
```

Hoặc sử dụng script Node.js đã được cung cấp:

```bash
node test-auth-login.js
```

### Phản hồi thành công:

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "email": "e.hoang@gmail.com",
    "full_name": "Hoàng Văn E",
    "role": "admin"
  }
}
```

## 2. Sử Dụng Token Để Truy Cập API Được Bảo Vệ

Sau khi có token, bạn cần thêm nó vào header `Authorization` với tiền tố `Bearer` cho mỗi yêu cầu API:

```bash
curl -X GET http://localhost:3501/api/comments \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Hoặc sử dụng script Node.js đã được cung cấp:

```bash
node test-protected-endpoint.js  # Kiểm tra endpoint /api/comments
node test-users-endpoint.js      # Kiểm tra endpoint /api/users (chỉ admin)
node test-wishlists-endpoint.js  # Kiểm tra endpoint /api/wishlists
```

## 3. Các API Yêu Cầu Xác Thực

Các endpoint sau đây yêu cầu token xác thực:

- `GET /api/auth/profile` - Lấy thông tin người dùng hiện tại
- `POST /api/comments` - Tạo bình luận mới
- `PUT /api/comments/:id` - Cập nhật bình luận
- `DELETE /api/comments/:id` - Xóa bình luận
- `GET /api/users` - Quản lý người dùng (chỉ admin)
- `GET /api/users/:id` - Xem thông tin người dùng cụ thể
- `PUT /api/users/:id` - Cập nhật thông tin người dùng
- `DELETE /api/users/:id` - Xóa người dùng (chỉ admin)
- `GET /api/users/:id/orders` - Xem đơn hàng của người dùng
- `GET /api/users/:id/wishlist` - Xem danh sách yêu thích của người dùng
- `GET /api/users/:id/reviews` - Xem đánh giá của người dùng
- `GET /api/wishlists` - Danh sách yêu thích của người dùng hiện tại
- `POST /api/wishlists` - Thêm sản phẩm vào danh sách yêu thích
- `DELETE /api/wishlists/:id` - Xóa sản phẩm khỏi danh sách yêu thích
- `DELETE /api/wishlists/product/:productId` - Xóa sản phẩm khỏi danh sách yêu thích theo ID sản phẩm
- `GET /api/wishlists/check/:productId` - Kiểm tra sản phẩm có trong danh sách yêu thích không
- `GET /api/orders` - Đơn hàng
- `GET /api/order-status` - Trạng thái đơn hàng
- `GET /api/payments` - Thanh toán
- `GET /api/couponcodes` - Mã giảm giá

## 4. Tài Khoản Có Sẵn Trong Hệ Thống

Hệ thống có sẵn các tài khoản sau:

| Email | Password | Role |
|-------|----------|------|
| e.hoang@gmail.com | hashed_password_5 | admin |
| a.nguyen@gmail.com | hashed_password_1 | user |
| b.tran@gmail.com | hashed_password_2 | user |
| c.le@gmail.com | hashed_password_3 | staff |
| d.pham@gmail.com | hashed_password_4 | user |

## 5. Cấu Trúc Token JWT

Token JWT bao gồm 3 phần:
- Header: Thông tin về thuật toán mã hóa
- Payload: Chứa thông tin người dùng (userId)
- Signature: Chữ ký để xác thực token

Token có thời hạn 24 giờ kể từ khi được tạo.

## 6. Xử Lý Lỗi Xác Thực

Các lỗi xác thực có thể gặp:

- `401 Unauthorized`: Token không hợp lệ hoặc đã hết hạn
- `403 Forbidden`: Không có quyền truy cập vào tài nguyên
- `404 Not Found`: Tài nguyên không tồn tại

## 7. Đăng Ký Tài Khoản Mới

### Endpoint: `POST /api/auth/register`

```bash
curl -X POST http://localhost:3501/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new.user@example.com",
    "password": "secure_password",
    "full_name": "Người Dùng Mới",
    "phone": "0123456789",
    "address": "123 Đường ABC, Thành phố XYZ"
  }'
```

## 8. Quản Lý Người Dùng (Dành Cho Admin)

### Lấy Danh Sách Người Dùng

```bash
curl -X GET http://localhost:3501/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Xem Chi Tiết Người Dùng

```bash
curl -X GET http://localhost:3501/api/users/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Cập Nhật Thông Tin Người Dùng

```bash
curl -X PUT http://localhost:3501/api/users/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Nguyễn Văn A (Đã cập nhật)",
    "phone": "0901234567",
    "address": "123 Đường A, Quận 1"
  }'
```

### Xóa Người Dùng (Chỉ Admin)

```bash
curl -X DELETE http://localhost:3501/api/users/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 9. Quản Lý Danh Sách Yêu Thích

### Lấy Danh Sách Yêu Thích Của Người Dùng Hiện Tại

```bash
curl -X GET http://localhost:3501/api/wishlists \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Thêm Sản Phẩm Vào Danh Sách Yêu Thích

```bash
curl -X POST http://localhost:3501/api/wishlists \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"product_id": 131}'
```

### Xóa Sản Phẩm Khỏi Danh Sách Yêu Thích

```bash
curl -X DELETE http://localhost:3501/api/wishlists/1 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Xóa Sản Phẩm Khỏi Danh Sách Yêu Thích Theo ID Sản Phẩm

```bash
curl -X DELETE http://localhost:3501/api/wishlists/product/131 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Kiểm Tra Sản Phẩm Có Trong Danh Sách Yêu Thích Không

```bash
curl -X GET http://localhost:3501/api/wishlists/check/131 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 10. Các Lưu Ý Về Bảo Mật

- Token JWT nên được bảo vệ và không nên chia sẻ
- Không lưu token trong localStorage hoặc sessionStorage không được bảo vệ
- Sử dụng HTTPS trong môi trường sản xuất
- Đổi mật khẩu định kỳ để tăng tính bảo mật 