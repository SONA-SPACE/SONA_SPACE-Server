// JavaScript for News Categories Management Page

document.addEventListener('DOMContentLoaded', function() {
    // Gắn các event handlers
    initTableSorting();
    initVisibilityToggles();
    initDeleteButtons();
    initEditButtons();
    
    // Activate navigation for current page
    setActiveNavigation();
});

// Khởi tạo chức năng sắp xếp bảng
function initTableSorting() {
    const table = document.getElementById('newsCategoriesTable');
    if (!table) return;
    
    const headers = table.querySelectorAll('th[data-sortable="true"]');
    headers.forEach(header => {
        header.addEventListener('click', function() {
            const isAscending = this.classList.contains('sort-asc');
            
            // Xóa classes sắp xếp khỏi tất cả headers
            headers.forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            
            // Thêm class sắp xếp cho header hiện tại
            this.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
            
            // Logic sắp xếp bảng sẽ được thêm vào đây
            console.log(`Sắp xếp theo ${this.textContent} theo thứ tự ${isAscending ? 'giảm dần' : 'tăng dần'}`);
        });
    });
}

// Xử lý nút ẩn/hiện danh mục
function initVisibilityToggles() {
    const visibilityButtons = document.querySelectorAll('.action-button.visibility');
    visibilityButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            const currentStatus = this.getAttribute('data-status');
            const newStatus = currentStatus === 'visible' ? 'hidden' : 'visible';
            const statusText = newStatus === 'visible' ? 'hiển thị' : 'ẩn';
            
            // Trong thực tế, đây sẽ là một API call
            console.log(`Chuyển trạng thái danh mục ${categoryId} thành ${statusText}`);
            
            // Cập nhật UI
            this.setAttribute('data-status', newStatus);
            
            // Cập nhật icon
            const iconElement = this.querySelector('i');
            iconElement.className = newStatus === 'visible' ? 'fas fa-eye-slash' : 'fas fa-eye';
            
            // Cập nhật tooltip
            this.setAttribute('title', newStatus === 'visible' ? 'Ẩn danh mục' : 'Hiển thị danh mục');
            
            // Cập nhật status indicator trong cùng hàng
            const row = this.closest('tr');
            const statusIndicator = row.querySelector('.status-indicator');
            statusIndicator.className = `status-indicator ${newStatus}`;
            statusIndicator.innerHTML = `<i class="fas fa-circle"></i> ${newStatus === 'visible' ? 'Hiển thị' : 'Ẩn'}`;
            
            // Hiển thị thông báo
            showToast(`Đã ${statusText} danh mục thành công!`, 'success');
        });
    });
}

// Xử lý nút xóa danh mục
function initDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.action-button.delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            const categoryName = this.getAttribute('data-name');
            
            if (confirm(`Bạn có chắc chắn muốn xóa danh mục "${categoryName}"? Hành động này không thể hoàn tác.`)) {
                // Trong thực tế, đây sẽ là một API call
                console.log(`Xóa danh mục ${categoryId} - ${categoryName}`);
                
                // Xóa hàng khỏi bảng
                const row = this.closest('tr');
                row.remove();
                
                // Hiển thị thông báo
                showToast(`Đã xóa danh mục "${categoryName}" thành công!`, 'success');
                
                // Cập nhật số lượng kết quả hiển thị
                updateResultsCount();
            }
        });
    });
}

// Xử lý nút chỉnh sửa danh mục
function initEditButtons() {
    const editButtons = document.querySelectorAll('.action-button.edit');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            
            // Trong thực tế, đây sẽ chuyển hướng đến trang chỉnh sửa danh mục
            console.log(`Chỉnh sửa danh mục ${categoryId}`);
            // window.location.href = `/dashboard/news-categories/edit/${categoryId}`;
            
            // Hiển thị thông báo tạm thời
            showToast('Đang chuyển đến trang chỉnh sửa danh mục...', 'info');
        });
    });
}

// Cập nhật thông tin số lượng kết quả
function updateResultsCount() {
    const resultsInfo = document.querySelector('.results-info');
    if (!resultsInfo) return;
    
    const tableRows = document.querySelectorAll('#newsCategoriesTable tbody tr');
    resultsInfo.textContent = `Hiển thị 1-${tableRows.length} trong tổng số ${tableRows.length} kết quả`;
}

// Hiển thị thông báo toast
function showToast(message, type = 'success') {
    // Kiểm tra nếu container toast đã tồn tại, nếu không thì tạo mới
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Tạo element toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.backgroundColor = type === 'success' ? '#d4edda' : 
                                 type === 'danger' ? '#f8d7da' : 
                                 type === 'warning' ? '#fff3cd' : '#d1ecf1';
    toast.style.color = type === 'success' ? '#155724' : 
                       type === 'danger' ? '#721c24' : 
                       type === 'warning' ? '#856404' : '#0c5460';
    toast.style.border = '1px solid ' + (type === 'success' ? '#c3e6cb' : 
                                        type === 'danger' ? '#f5c6cb' : 
                                        type === 'warning' ? '#ffeeba' : '#bee5eb');
    toast.style.borderRadius = '4px';
    toast.style.padding = '12px 20px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '400px';
    
    toast.innerHTML = message;
    
    // Thêm toast vào container
    toastContainer.appendChild(toast);
    
    // Tự động ẩn toast sau 3 giây
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        
        // Xóa toast khỏi DOM sau khi đã ẩn
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 3000);
}

// Đánh dấu active cho menu hiện tại
function setActiveNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        const link = item.querySelector('a');
        if (link && link.getAttribute('href') === '/dashboard/news-categories') {
            item.classList.add('active');
        }
    });
} 