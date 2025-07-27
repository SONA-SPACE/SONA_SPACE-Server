## ✅ QUY TRÌNH HOÀN TRẢ ĐƠN HÀNG MỚI ĐÃ HOÀN THÀNH

### 🔄 Luồng xử lý mới:
1. **PENDING** (Mặc định) - Đang chờ xử lý
2. **APPROVED** - Đã duyệt trả hàng  
3. **CANCEL_CONFIRMED** - Xác nhận hủy đơn hàng
4. **CANCELLED** - Đã hủy hoàn tất ✅ (Chuyển order status thành RETURN)
5. **REJECTED** - Từ chối trả hàng (có thể thực hiện từ PENDING/APPROVED)

### 🎯 Các thay đổi đã thực hiện:

#### Backend API (/routes/orders.js):
- ✅ Cập nhật `validReturnStatuses` với trạng thái mới
- ✅ Thay đổi logic: CANCELLED (thay vì COMPLETED) chuyển order thành RETURN
- ✅ Cập nhật text hiển thị cho từng trạng thái
- ✅ Giữ nguyên logic tạo bản ghi mới với trạng thái do admin chọn

#### Frontend (orders.ejs):
- ✅ Cập nhật `mapReturnStatus()` với quy trình mới
- ✅ Thay đổi default từ REQUESTED → PENDING
- ✅ Cập nhật `mapReturnStatusText()` với text mới
- ✅ Cập nhật filter dropdown header với options mới
- ✅ Cập nhật logic filter JavaScript

### 🧪 Test Results:
- ✅ PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED: SUCCESS
- ✅ PENDING → REJECTED: SUCCESS  
- ✅ Database cập nhật chính xác
- ✅ Order status chuyển thành RETURN khi CANCELLED

### 🎮 Sử dụng:
1. Admin chọn "Đang chờ xử lý" từ dropdown
2. Tiếp theo có thể chọn "Đã duyệt trả hàng" 
3. Tiếp theo "Xác nhận hủy đơn hàng"
4. Cuối cùng "Đã hủy hoàn tất" → Order status = RETURN
5. Hoặc chọn "Từ chối trả hàng" từ bất kỳ bước nào

### 📝 Lưu ý:
- Không thể lùi bước trong quy trình (trừ reset về trạng thái trước)
- REJECTED có thể chọn từ PENDING hoặc APPROVED
- Chỉ CANCELLED mới chuyển order status thành RETURN
- Empty value ("") sẽ xóa bản ghi return
