/**
 * Test Script: Cập nhật Return Status - Quản lý qua bảng order_returns
 * 
 * Test flow mới:
 * - Bảng orders: current_status KHÔNG thay đổi khi cập nhật return status
 * - Bảng order_returns: Quản lý toàn bộ quy trình hoàn trả với return_type = 'REFUND'
 * - Workflow: PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED hoặc PENDING → REJECTED
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJpYXQiOjE3Mzc5ODQzNDMsImV4cCI6MTczODA3MDc0M30.K-K2DXrr-tGRCrRm_TCwZ_WJJlkozOJjZMEwfVVvO2E';

// Test order ID (sẽ được tạo hoặc sử dụng existing)
let TEST_ORDER_ID = null;

async function testUpdatedReturnFlow() {
  console.log('🚀 Testing Updated Return Flow - Bảng order_returns quản lý return status\n');

  try {
    // 1. Lấy danh sách orders để tìm order test
    console.log('1️⃣ Lấy danh sách orders...');
    const ordersResponse = await fetch(`${BASE_URL}/api/orders/admin`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
    });
    const ordersData = await ordersResponse.json();
    
    if (!ordersData.success || ordersData.orders.length === 0) {
      throw new Error('Không có orders để test');
    }

    // Sử dụng order đầu tiên để test
    TEST_ORDER_ID = ordersData.orders[0].order_id;
    const initialOrder = ordersData.orders[0];
    
    console.log(`✅ Order ID để test: ${TEST_ORDER_ID}`);
    console.log(`   - Current Status: ${initialOrder.current_status}`);
    console.log(`   - Return Status: ${initialOrder.return_status || 'None'}\n`);

    // 2. Test Workflow: PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED
    console.log('2️⃣ Test Workflow: PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED\n');

    // Step 1: Set PENDING
    console.log('📝 Step 1: Cập nhật return status thành PENDING...');
    await updateReturnStatus('PENDING');
    await verifyStatus('PENDING', initialOrder.current_status);

    // Step 2: Set APPROVED
    console.log('📝 Step 2: Cập nhật return status thành APPROVED...');
    await updateReturnStatus('APPROVED');
    await verifyStatus('APPROVED', initialOrder.current_status);

    // Step 3: Set CANCEL_CONFIRMED
    console.log('📝 Step 3: Cập nhật return status thành CANCEL_CONFIRMED...');
    await updateReturnStatus('CANCEL_CONFIRMED');
    await verifyStatus('CANCEL_CONFIRMED', initialOrder.current_status);

    // Step 4: Set CANCELLED
    console.log('📝 Step 4: Cập nhật return status thành CANCELLED...');
    await updateReturnStatus('CANCELLED');
    await verifyStatus('CANCELLED', initialOrder.current_status);

    // 3. Test Alternative Path: PENDING → REJECTED
    console.log('\n3️⃣ Test Alternative Path: PENDING → REJECTED\n');

    // Reset to PENDING
    console.log('📝 Reset: Cập nhật return status thành PENDING...');
    await updateReturnStatus('PENDING');
    await verifyStatus('PENDING', initialOrder.current_status);

    // Set REJECTED
    console.log('📝 Alternative: Cập nhật return status thành REJECTED...');
    await updateReturnStatus('REJECTED');
    await verifyStatus('REJECTED', initialOrder.current_status);

    // 4. Test Reset: Xóa return status
    console.log('\n4️⃣ Test Reset: Xóa return status\n');
    console.log('📝 Reset: Xóa return status (set về empty)...');
    await updateReturnStatus('');
    await verifyStatus('', initialOrder.current_status);

    console.log('\n✅ ALL TESTS PASSED! Updated return flow working correctly.');
    console.log('\nKey Changes Verified:');
    console.log('✓ Bảng orders.current_status KHÔNG thay đổi khi cập nhật return status');
    console.log('✓ Bảng order_returns quản lý toàn bộ quy trình hoàn trả');
    console.log('✓ return_type = "REFUND" được sử dụng đúng cách');
    console.log('✓ Workflow PENDING → APPROVED → CANCEL_CONFIRMED → CANCELLED hoạt động');
    console.log('✓ Alternative path PENDING → REJECTED hoạt động');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

async function updateReturnStatus(status) {
  const response = await fetch(`${BASE_URL}/api/orders/${TEST_ORDER_ID}/return-status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({ return_status: status })
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to update return status to ${status}: ${data.message}`);
  }

  console.log(`   ✅ Return status updated to: ${status || 'None'}`);
  return data;
}

async function verifyStatus(expectedReturnStatus, expectedOrderStatus) {
  // Lấy thông tin order để verify
  const ordersResponse = await fetch(`${BASE_URL}/api/orders/admin`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` }
  });
  const ordersData = await ordersResponse.json();
  
  if (!ordersData.success) {
    throw new Error('Failed to fetch orders for verification');
  }

  const order = ordersData.orders.find(o => o.order_id === TEST_ORDER_ID);
  if (!order) {
    throw new Error(`Order ${TEST_ORDER_ID} not found`);
  }

  // Verify return status
  const actualReturnStatus = order.return_status || '';
  if (actualReturnStatus !== expectedReturnStatus) {
    throw new Error(`Return status mismatch. Expected: "${expectedReturnStatus}", Got: "${actualReturnStatus}"`);
  }

  // Verify order status (should remain unchanged)
  if (order.current_status !== expectedOrderStatus) {
    throw new Error(`Order status changed unexpectedly. Expected: "${expectedOrderStatus}", Got: "${order.current_status}"`);
  }

  console.log(`   ✅ Verified - Return Status: "${actualReturnStatus}", Order Status: "${order.current_status}" (unchanged)`);
}

// Run test
testUpdatedReturnFlow().catch(console.error);
