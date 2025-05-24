# SONA_SPACE-Server - API Documentation

## Giới thiệu

SONA_SPACE-Server là một RESTful API backend cho cửa hàng nội thất trực tuyến Furnitown. API này được xây dựng bằng Node.js và Express, kết nối với cơ sở dữ liệu MySQL.

## Cài đặt

### Yêu cầu

- Node.js (>= 14.x)
- MySQL (>= 5.7)
- npm hoặc yarn

### Các bước cài đặt

1. Clone repository:
   ```bash
   git clone https://github.com/SONA-SPACE/SONA_SPACE-Server.git
   cd SONA_SPACE-Server
   ```

2. Cài đặt các package:
   ```bash
   npm install
   ```

3. Cấu hình môi trường:
   - Tạo file `.env` dựa trên file `.env.example`
   - Cập nhật thông tin kết nối database

4. Khởi động server:
   ```bash
   npm start
   ```

   Hoặc ở môi trường development:
   ```bash
   npm run dev
   ```

## Cấu trúc API

API được xây dựng theo chuẩn RESTful với các endpoint cơ bản:

### Authentication

- `POST /api/auth/register` - Đăng ký người dùng mới
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy thông tin người dùng hiện tại (yêu cầu xác thực)

### Products

- `GET /api/products` - Lấy danh sách sản phẩm (có phân trang, lọc, sắp xếp)
- `GET /api/products/:id` - Lấy thông tin chi tiết một sản phẩm
- `POST /api/products` - Tạo sản phẩm mới (admin)
- `PUT /api/products/:id` - Cập nhật thông tin sản phẩm (admin)
- `DELETE /api/products/:id` - Xóa sản phẩm (admin)
- `GET /api/products/featured/list` - Lấy danh sách sản phẩm nổi bật
- `GET /api/products/by-category/:categoryId` - Lấy sản phẩm theo danh mục

### Categories

- `GET /api/categories` - Lấy danh sách danh mục
- `GET /api/categories/:id` - Lấy thông tin một danh mục
- `POST /api/categories` - Tạo danh mục mới (admin)
- `PUT /api/categories/:id` - Cập nhật thông tin danh mục (admin)
- `DELETE /api/categories/:id` - Xóa danh mục (admin)
- `GET /api/categories/:id/products` - Lấy sản phẩm thuộc danh mục

### Users

- `GET /api/users` - Lấy danh sách người dùng (admin)
- `GET /api/users/:id` - Lấy thông tin người dùng
- `PUT /api/users/:id` - Cập nhật thông tin người dùng
- `DELETE /api/users/:id` - Xóa người dùng (admin)
- `GET /api/users/:id/orders` - Lấy đơn hàng của người dùng
- `GET /api/users/:id/wishlist` - Lấy danh sách yêu thích của người dùng
- `GET /api/users/:id/reviews` - Lấy đánh giá sản phẩm của người dùng

### Orders

- `GET /api/orders` - Lấy danh sách đơn hàng (admin)
- `GET /api/orders/:id` - Lấy thông tin chi tiết đơn hàng
- `POST /api/orders` - Tạo đơn hàng mới
- `PUT /api/orders/:id/status` - Cập nhật trạng thái đơn hàng (admin)
- `DELETE /api/orders/:id` - Hủy đơn hàng
- `GET /api/orders/status/count` - Lấy số lượng đơn hàng theo trạng thái (admin)

### Wishlists

- `GET /api/wishlists` - Lấy danh sách wishlist của người dùng hiện tại
- `POST /api/wishlists` - Thêm sản phẩm vào wishlist
- `DELETE /api/wishlists/:id` - Xóa sản phẩm khỏi wishlist
- `DELETE /api/wishlists/product/:productId` - Xóa sản phẩm khỏi wishlist theo product_id
- `GET /api/wishlists/check/:productId` - Kiểm tra sản phẩm có trong wishlist không

### Và các API khác
- Comments
- News
- Variants
- Rooms
- Payments
- Couponcodes
- Contact Forms

## Xác thực API

API sử dụng JWT (JSON Web Token) để xác thực. Token được trả về khi đăng nhập thành công và cần được gửi trong header của mỗi request yêu cầu xác thực:

```
Authorization: Bearer <token>
```

## Phân quyền

- **Public**: Bất kỳ ai cũng có thể truy cập (không yêu cầu xác thực)
- **Private**: Yêu cầu đăng nhập (token hợp lệ)
- **Admin**: Chỉ admin mới có quyền truy cập

## Xử lý lỗi

API trả về mã lỗi HTTP phù hợp với từng trường hợp:

- `400 Bad Request` - Dữ liệu gửi lên không hợp lệ
- `401 Unauthorized` - Token không hợp lệ hoặc hết hạn
- `403 Forbidden` - Không có quyền truy cập
- `404 Not Found` - Không tìm thấy tài nguyên
- `500 Internal Server Error` - Lỗi server

Response JSON sẽ bao gồm thông tin lỗi:

```json
{
  "error": "Mô tả lỗi"
}
```

## Mở rộng

Để thêm tính năng mới, bạn có thể:
1. Tạo route mới trong thư mục `routes/`
2. Đăng ký route trong file `app.js`

---

API được phát triển bởi SONA SPACE team.