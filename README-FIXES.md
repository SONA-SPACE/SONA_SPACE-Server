# Các Lỗi Đã Sửa và Cải Tiến API

## 1. Sửa lỗi SQL trong các file:

### a. `routes/products.js`
- Sửa tên bảng và cột cho đúng với cấu trúc cơ sở dữ liệu.

### b. `routes/categories.js`
- Sửa tên bảng và cột cho đúng với cấu trúc cơ sở dữ liệu.

### c. `routes/variants.js`
- Sửa tên bảng và cột cho đúng với cấu trúc cơ sở dữ liệu.

### d. `routes/rooms.js`
- Sửa tên bảng và cột cho đúng với cấu trúc cơ sở dữ liệu.

### e. `routes/news.js`
- Sửa tên bảng và cột cho đúng với cấu trúc cơ sở dữ liệu.

### f. `routes/newsCategories.js`
- Tạo mới API endpoint để sinh danh mục tin tức từ bảng `news` vì không có bảng `news_categories`.

### g. `routes/users.js`
- Sửa tên cột trong các truy vấn SQL, thay `id` thành `user_id`, `email` thành `user_gmail`, `full_name` thành `user_name`, `phone` thành `user_number`, `role` thành `user_role`, `password` thành `user_password`.
- Sửa các endpoint `/api/users/:id/orders`, `/api/users/:id/wishlist`, và `/api/users/:id/reviews` để sử dụng đúng tên cột trong các bảng liên quan.
- Sửa tham chiếu đến các khóa ngoại, ví dụ: `order.id` thành `order.order_id`, `order_status.id` thành `order_status.order_status_id`.
- Cập nhật logic để lấy thông tin thanh toán và chi tiết đơn hàng.

### h. `routes/wishlists.js`
- Sửa tên cột trong các truy vấn SQL, thay `id` thành `wishlist_id` trong bảng `wishlist`, và `id` thành `product_id` trong bảng `product`.
- Sửa tham chiếu đến bảng không tồn tại `product_categories` thành bảng `category`.
- Sửa tên cột `name` thành `category_name` trong bảng `category`.
- Sửa tên cột `rating` thành `comment_rating` trong bảng `comment`.

## 2. Khởi động server:
- Sử dụng lệnh `node bin/www` để khởi động server.
- Nếu có lỗi về port đã được sử dụng, hãy tắt các tiến trình node.js đang chạy bằng lệnh `taskkill /F /IM node.exe` (Windows) hoặc `killall node` (Linux/Mac).

## 3. Cải tiến xử lý lỗi:
- Thêm xử lý lỗi chi tiết hơn trong route handler của categories.

## 4. Các script test đã tạo:
- `test-products-endpoint.js`: Kiểm tra endpoint `/api/products`
- `test-categories-endpoint.js`: Kiểm tra endpoint `/api/categories`
- `test-variants-endpoint.js`: Kiểm tra endpoint `/api/variants`
- `test-rooms-endpoint.js`: Kiểm tra endpoint `/api/rooms`
- `test-news-endpoint.js`: Kiểm tra endpoint `/api/news`
- `test-news-categories-endpoint.js`: Kiểm tra endpoint `/api/news-categories`
- `test-comments-endpoint.js`: Kiểm tra endpoint `/api/comments`
- `test-auth-login.js`: Kiểm tra đăng nhập và lấy token
- `test-protected-endpoint.js`: Kiểm tra truy cập endpoint được bảo vệ
- `test-users-endpoint.js`: Kiểm tra endpoint `/api/users` (yêu cầu quyền admin)
- `test-user-details.js`: Kiểm tra chi tiết người dùng, đơn hàng, wishlist và đánh giá
- `test-wishlists-endpoint.js`: Kiểm tra endpoint `/api/wishlists`

## 5. Hướng dẫn sử dụng:
- Khởi động server: `node bin/www`
- Chạy các script test để kiểm tra các endpoint.

## 6. API Endpoint đã hoạt động:
1. `/api/products` - Danh sách sản phẩm
2. `/api/categories` - Danh sách danh mục
3. `/api/variants` - Danh sách biến thể
4. `/api/rooms` - Danh sách phòng
5. `/api/news` - Danh sách tin tức
6. `/api/news-categories` - Danh sách danh mục tin tức
7. `/api/comments` - Danh sách bình luận
8. `/api/auth/login` - Đăng nhập và lấy token
9. `/api/users` - Quản lý người dùng (yêu cầu quyền admin)
10. `/api/users/:id` - Thông tin chi tiết người dùng
11. `/api/users/:id/orders` - Danh sách đơn hàng của người dùng
12. `/api/users/:id/wishlist` - Danh sách yêu thích của người dùng
13. `/api/users/:id/reviews` - Đánh giá của người dùng
14. `/api/wishlists` - Danh sách yêu thích của người dùng hiện tại

## 7. Ghi chú cho phát triển tiếp theo:
- Cải thiện xử lý lỗi và validation trong tất cả các endpoint.
- Thêm logging để dễ dàng debug.
- Cân nhắc cải thiện cấu trúc cơ sở dữ liệu để tối ưu hóa truy vấn.
- Thêm tài liệu API chi tiết.
- Thêm unit test và integration test.
- Tham khảo file `AUTH-GUIDE.md` để biết thêm chi tiết về xác thực và ủy quyền.

## 3. `routes/orders.js`

- Thay thế `u.id` bằng `u.user_id` trong các mệnh đề JOIN
- Thay thế `o.id` bằng `o.order_id` 
- Thay thế `os.id` bằng `os.order_status_id`
- Thay thế `os.name` bằng `os.order_status_name`
- Thay thế `os.description` bằng `os.order_status_description`
- Thay thế `status_id` bằng `order_status_id`
- Thay thế `p.id` bằng `p.product_id`
- Thay thế `p.name` bằng `p.product_name`
- Thay thế `p.sku` bằng `p.product_sku`
- Thay thế `p.image` bằng `p.product_image`
- Thay thế `v.id` bằng `v.variant_id`
- Loại bỏ tham chiếu đến cột không tồn tại `p.payment_method` và `p.payment_status` trong truy vấn JOIN với bảng `payment` 

## Payments API Fixes

Several SQL-related issues were found and fixed in the payments API:

1. Table name corrections:
   - Changed `orders` to `` `order` `` (with backticks to escape the SQL keyword)
   - Used correct column names across all queries

2. Column name corrections:
   - Changed `o.id` to `o.order_id`
   - Changed `u.id` to `u.user_id` 
   - Changed `u.name` to `u.user_name`
   - Changed `u.email` to `u.user_gmail`
   - Changed `p.id` to `p.payment_id`
   - Changed `o.order_number` to `o.order_hash`
   - Changed `o.total` to `o.order_total`

3. Updated all affected SQL queries in:
   - `routes/payments.js`

4. Created a test script:
   - `test-payments.js` to verify the correct functioning of the payments endpoints

These changes ensure that the payments API works correctly with the database schema, preventing errors like "Table 'furnitown.orders' doesn't exist" and allowing the system to properly display and manage payment information. 