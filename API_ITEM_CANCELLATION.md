# API Documentation - Order Item Cancellation

## Tổng quan
Hệ thống đã được mở rộng với khả năng hủy sản phẩm riêng lẻ trong đơn hàng thay vì phải hủy toàn bộ đơn hàng.

## Endpoints mới

### 1. Lấy danh sách sản phẩm trong đơn hàng
**GET** `/api/orders-id/items/:orderId`

**Mô tả:** Lấy danh sách chi tiết tất cả sản phẩm trong một đơn hàng cụ thể.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response thành công (200):**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 476,
      "hash": "SN79746407",
      "status": "PENDING"
    },
    "items": [
      {
        "item_id": 385,
        "variant_id": 327,
        "product": {
          "id": 123,
          "name": "Bàn cà phê chức năng Chiva",
          "slug": "ban-ca-phe-chuc-nang-chiva",
          "image": "/images/products/chiva.jpg",
          "category": "Bàn cà phê"
        },
        "color": {
          "name": "Nâu gỗ",
          "hex": "#8B4513"
        },
        "quantity": 1,
        "price": 30000000,
        "item_total": 30000000,
        "status": "NORMAL",
        "can_cancel": true,
        "created_at": "2025-08-25T11:19:09.000Z",
        "updated_at": "2025-08-25T11:19:09.000Z"
      },
      {
        "item_id": 386,
        "variant_id": 257,
        "product": {
          "id": 124,
          "name": "Sofa Amsterdam",
          "slug": "sofa-amsterdam",
          "image": "/images/products/amsterdam.jpg",
          "category": "Sofa"
        },
        "color": {
          "name": "Xám",
          "hex": "#808080"
        },
        "quantity": 1,
        "price": 25000000,
        "item_total": 25000000,
        "status": "NORMAL",
        "can_cancel": true,
        "created_at": "2025-08-25T11:19:09.000Z",
        "updated_at": "2025-08-25T11:19:09.000Z"
      }
    ],
    "summary": {
      "total_items": 2,
      "active_items": 2,
      "cancelled_items": 0,
      "total_value": 55000000
    }
  }
}
```

### 2. Hủy sản phẩm riêng lẻ
**PUT** `/api/orders-id/cancel-item/:orderId/:itemId`

**Mô tả:** Hủy một sản phẩm cụ thể trong đơn hàng mà không ảnh hưởng đến các sản phẩm khác.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "reason": "Khách hàng đổi ý về sản phẩm này"
}
```

**Response thành công (200):**
```json
{
  "success": true,
  "message": "Hủy sản phẩm \"Bàn cà phê chức năng Chiva\" thành công.",
  "data": {
    "order_id": 476,
    "order_hash": "SN79746407",
    "cancelled_item": {
      "item_id": 385,
      "product_name": "Bàn cà phê chức năng Chiva",
      "quantity": 1,
      "refund_amount": 30000000
    },
    "remaining_items": 1
  }
}
```

## So sánh với endpoint hủy đơn hàng cũ

### Endpoint cũ: `/api/orders-id/cancel/:orderId`
- **Chức năng:** Hủy toàn bộ đơn hàng
- **Ảnh hưởng:** Tất cả sản phẩm trong đơn hàng bị hủy
- **Trạng thái đơn hàng:** Chuyển sang `CANCELLED`
- **Kho hàng:** Cộng lại tất cả sản phẩm vào kho

### Endpoint mới: `/api/orders-id/cancel-item/:orderId/:itemId`
- **Chức năng:** Hủy một sản phẩm cụ thể
- **Ảnh hưởng:** Chỉ sản phẩm được chọn bị hủy
- **Trạng thái đơn hàng:** Giữ nguyên (trừ khi hủy hết sản phẩm)
- **Kho hàng:** Chỉ cộng lại sản phẩm bị hủy

## Quy trình xử lý

### Khi hủy một sản phẩm:
1. **Kiểm tra quyền:** User chỉ có thể hủy sản phẩm trong đơn hàng của mình
2. **Kiểm tra điều kiện:**
   - Đơn hàng phải ở trạng thái `PENDING` hoặc `CONFIRMED`
   - Sản phẩm phải ở trạng thái `NORMAL`
   - Không quá 72 giờ kể từ khi đặt hàng (đối với user thường)
3. **Cập nhật database:**
   - Đổi trạng thái sản phẩm: `NORMAL` → `RETURN_REQUESTED`
   - Cộng lại kho cho variant sản phẩm
   - Giảm số lượng đã bán của sản phẩm
   - Trừ giá trị sản phẩm khỏi tổng đơn hàng
   - Tạo bản ghi trong `order_returns`
   - Ghi log trong `order_status_log`
4. **Kiểm tra đơn hàng:** Nếu không còn sản phẩm nào, hủy toàn bộ đơn hàng
5. **Thông báo:** Gửi thông báo cho khách hàng (nếu admin thực hiện)

## Ví dụ sử dụng

### Scenario: Khách hàng đặt 2 sản phẩm nhưng muốn hủy 1 sản phẩm

**Bước 1:** Lấy danh sách sản phẩm
```bash
GET /api/orders-id/items/476
```

**Bước 2:** Chọn sản phẩm cần hủy (ví dụ: item_id = 385)
```bash
PUT /api/orders-id/cancel-item/476/385
Body: {"reason": "Khách hàng không thích màu sắc"}
```

**Kết quả:**
- Sản phẩm "Bàn cà phê chức năng Chiva" bị hủy
- Đơn hàng vẫn còn "Sofa Amsterdam"
- Tổng tiền đơn hàng giảm từ 55.030.000đ xuống 25.030.000đ
- Kho "Bàn cà phê chức năng Chiva" tăng lên 1

## Trạng thái sản phẩm (current_status)

- **NORMAL:** Sản phẩm bình thường, có thể hủy
- **RETURN_REQUESTED:** Sản phẩm đã được yêu cầu hủy
- **RETURN_APPROVED:** Yêu cầu hủy đã được phê duyệt
- **RETURNED:** Sản phẩm đã được trả lại
- **REFUNDED:** Sản phẩm đã được hoàn tiền

## Quyền hạn

### User thường:
- Chỉ có thể hủy sản phẩm trong đơn hàng của mình
- Chỉ có thể hủy khi đơn hàng ở trạng thái `PENDING` hoặc `CONFIRMED`
- Không thể hủy sau 72 giờ

### Admin:
- Có thể hủy sản phẩm trong bất kỳ đơn hàng nào
- Không bị giới hạn thời gian
- Có thể hủy ở mọi trạng thái đơn hàng

## Error Handling

### Lỗi phổ biến:
- **404:** Không tìm thấy đơn hàng hoặc sản phẩm
- **400:** Sản phẩm không thể hủy (đã hủy hoặc đơn hàng ở trạng thái không cho phép)
- **403:** Không có quyền hủy sản phẩm
- **500:** Lỗi server

### Ví dụ response lỗi:
```json
{
  "success": false,
  "message": "Không thể hủy sản phẩm khi đơn hàng ở trạng thái: SHIPPING. Chỉ có thể hủy sản phẩm khi đơn hàng ở trạng thái PENDING hoặc CONFIRMED."
}
```

## Testing

Sử dụng file `test-item-cancellation.js` để test các chức năng:

```bash
node test-item-cancellation.js
```

**Lưu ý:** Cần có token xác thực hợp lệ để test API endpoints.
