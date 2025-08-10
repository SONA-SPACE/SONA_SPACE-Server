-- Thêm cột return_images vào bảng order_returns
USE sonaspace;
ALTER TABLE order_returns ADD return_images VARCHAR(2500) NULL AFTER reason;

-- Kiểm tra cấu trúc bảng
DESCRIBE order_returns;
