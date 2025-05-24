const axios = require('axios');

const BASE_URL = 'http://localhost:3500';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDgwOTY4OTQsImV4cCI6MTc0ODE4MzI5NH0.hipEvvMWR9Fj_qCIK8Syf_Sb0IbiqJVkQP6OLtjLe1k';

// Giải mã token để hiển thị thông tin
function decodeJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

// Hiển thị thông tin token
const tokenInfo = decodeJWT(USER_TOKEN);
console.log('Thông tin token:');
console.log('- ID người dùng:', tokenInfo.id);
console.log('- Vai trò:', tokenInfo.role);
console.log('- Thời gian tạo:', new Date(tokenInfo.iat * 1000).toLocaleString());
console.log('- Thời gian hết hạn:', new Date(tokenInfo.exp * 1000).toLocaleString());

// 1. Lấy tất cả các thanh toán (để xem thanh toán nào thuộc về người dùng)
async function getAllPayments() {
    console.log('\n1. Lấy tất cả các thanh toán');
    console.log('----------------------------');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/payments`, {
            headers: {
                'Authorization': `Bearer ${USER_TOKEN}`
            }
        });
        
        console.log('Tìm thấy', response.data.length, 'thanh toán');
        
        // Tìm kiếm thanh toán thuộc về người dùng hiện tại
        const userPayments = response.data.filter(payment => payment.user_id === tokenInfo.id);
        
        if (userPayments.length > 0) {
            console.log('Tìm thấy', userPayments.length, 'thanh toán thuộc về người dùng', tokenInfo.id);
            console.log('Thanh toán đầu tiên:', userPayments[0]);
            return userPayments[0].payment_id;
        } else {
            console.log('Không tìm thấy thanh toán nào thuộc về người dùng', tokenInfo.id);
        }
        
        return null;
    } catch (error) {
        console.log('Lỗi khi lấy tất cả các thanh toán:');
        if (error.response) {
            console.log('- Mã trạng thái:', error.response.status);
            console.log('- Lỗi:', error.response.data);
        } else {
            console.log('- Lỗi:', error.message);
        }
        return null;
    }
}

// 2. Lấy thông tin đơn hàng của người dùng
async function getUserOrders() {
    console.log('\n2. Lấy đơn hàng của người dùng');
    console.log('------------------------------');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/users/${tokenInfo.id}/orders`, {
            headers: {
                'Authorization': `Bearer ${USER_TOKEN}`
            }
        });
        
        if (response.data && response.data.length > 0) {
            console.log('Tìm thấy', response.data.length, 'đơn hàng');
            return response.data[0].order_id;
        } else {
            console.log('Không tìm thấy đơn hàng nào');
        }
        
        return null;
    } catch (error) {
        console.log('Lỗi khi lấy đơn hàng của người dùng:');
        if (error.response) {
            console.log('- Mã trạng thái:', error.response.status);
            console.log('- Lỗi:', error.response.data);
        } else {
            console.log('- Lỗi:', error.message);
        }
        return null;
    }
}

// 3. Tạo đơn hàng với tất cả các trường bắt buộc
async function createOrder() {
    console.log('\n3. Tạo đơn hàng mới');
    console.log('-------------------');
    
    try {
        // Dữ liệu đơn hàng đầy đủ
        const orderData = {
            order_address1: '123 Lê Lợi, Phường Bến Nghé',
            order_address2: 'Quận 1',
            order_number1: '0987654321',
            order_number2: 'Nguyễn Văn A',
            order_shipping_fee: 30000,
            order_shipping_method: 'Giao hàng tiêu chuẩn',
            order_status_id: 1, // Trạng thái mới tạo
            items: [
                {
                    product_id: 1,
                    quantity: 2
                }
            ]
        };
        
        console.log('Gửi dữ liệu đơn hàng:', JSON.stringify(orderData, null, 2));
        
        const response = await axios.post(`${BASE_URL}/api/orders`, orderData, {
            headers: {
                'Authorization': `Bearer ${USER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Đơn hàng đã được tạo thành công!');
        console.log('- ID đơn hàng:', response.data.order.order_id);
        console.log('- Mã đơn hàng:', response.data.order.order_hash);
        console.log('- Tổng tiền:', response.data.order.order_total || response.data.order.order_total_final);
        
        return response.data.order;
    } catch (error) {
        console.log('Lỗi khi tạo đơn hàng:');
        if (error.response) {
            console.log('- Mã trạng thái:', error.response.status);
            console.log('- Lỗi:', error.response.data);
            // Kiểm tra nếu đây là lỗi thiếu trường, hiển thị request body
            if (error.response.status === 400 && error.response.data.error === 'Missing required fields') {
                console.log('- Request body:', error.config.data);
            }
        } else {
            console.log('- Lỗi:', error.message);
        }
        return null;
    }
}

// 4. Tạo thanh toán cho đơn hàng
async function createPayment(orderId, amount) {
    if (!orderId) return null;
    
    console.log('\n4. Tạo thanh toán cho đơn hàng ID:', orderId);
    console.log('-----------------------------------');
    
    try {
        const paymentData = {
            order_id: orderId,
            payment_method: 'Bank Transfer',
            transaction_id: 'TXN' + Date.now(),
            amount: amount || 0,
            status: 'completed'
        };
        
        console.log('Gửi dữ liệu thanh toán:', JSON.stringify(paymentData, null, 2));
        
        const response = await axios.post(`${BASE_URL}/api/payments`, paymentData, {
            headers: {
                'Authorization': `Bearer ${USER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Thanh toán đã được tạo thành công!');
        console.log('- ID thanh toán:', response.data.payment.payment_id);
        console.log('- Số tiền:', response.data.payment.amount);
        console.log('- Trạng thái:', response.data.payment.status);
        
        return response.data.payment;
    } catch (error) {
        console.log('Lỗi khi tạo thanh toán:');
        if (error.response) {
            console.log('- Mã trạng thái:', error.response.status);
            console.log('- Lỗi:', error.response.data);
        } else {
            console.log('- Lỗi:', error.message);
        }
        return null;
    }
}

// 5. Lấy thông tin chi tiết thanh toán
async function getPaymentDetails(paymentId) {
    if (!paymentId) return null;
    
    console.log('\n5. Lấy thông tin chi tiết thanh toán ID:', paymentId);
    console.log('------------------------------------------');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${USER_TOKEN}`
            }
        });
        
        console.log('Lấy thông tin chi tiết thanh toán thành công!');
        console.log('Thông tin thanh toán:', response.data);
        
        return response.data;
    } catch (error) {
        console.log('Lỗi khi lấy thông tin chi tiết thanh toán:');
        if (error.response) {
            console.log('- Mã trạng thái:', error.response.status);
            console.log('- Lỗi:', error.response.data);
        } else {
            console.log('- Lỗi:', error.message);
        }
        return null;
    }
}

// Chạy các bước test
async function runTest() {
    try {
        // 1. Kiểm tra các thanh toán hiện có
        const userPaymentId = await getAllPayments();
        
        // 2. Kiểm tra đơn hàng của người dùng
        const userOrderId = await getUserOrders();
        
        // 3. Nếu người dùng đã có thanh toán, thử truy cập
        if (userPaymentId) {
            await getPaymentDetails(userPaymentId);
        } else {
            console.log('Không tìm thấy thanh toán của người dùng, sẽ tạo mới');
            
            // 4. Tạo đơn hàng mới
            const order = await createOrder();
            
            // 5. Tạo thanh toán cho đơn hàng
            if (order) {
                const payment = await createPayment(order.order_id, order.order_total || order.order_total_final);
                
                // 6. Lấy thông tin chi tiết thanh toán vừa tạo
                if (payment) {
                    await getPaymentDetails(payment.payment_id);
                }
            }
        }
        
        // 7. Thử truy cập payment ID=1 (để thấy lỗi 403)
        await getPaymentDetails(1);
        
        console.log('\nHoàn thành kiểm tra!');
    } catch (error) {
        console.log('Lỗi không xác định:', error.message);
    }
}

// Bắt đầu thực hiện kiểm tra
runTest();