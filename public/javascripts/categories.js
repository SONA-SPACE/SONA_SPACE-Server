// Categories Management JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize table sorting
    initializeSorting();
    
    // Initialize form validation if adding/editing categories
    initializeFormValidation();
    
    // Add event listeners for action buttons
    setupActionButtons();
});

// Initialize table sorting functionality
function initializeSorting() {
    const table = document.getElementById('categoriesTable');
    if (!table) return;
    
    const headerCells = table.querySelectorAll('th[data-sortable="true"]');
    headerCells.forEach(cell => {
        cell.addEventListener('click', function() {
            const columnIndex = Array.from(cell.parentNode.children).indexOf(cell);
            sortTable('categoriesTable', columnIndex);
        });
        
        // Add sort indicator and cursor style
        cell.style.cursor = 'pointer';
        cell.innerHTML += ' <i class="fas fa-sort text-muted ms-1"></i>';
    });
}

// Sort table function
function sortTable(tableId, columnIndex) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Get the current sort direction
    const th = table.querySelectorAll('th')[columnIndex];
    const currentDir = th.getAttribute('data-sort') === 'asc' ? 'desc' : 'asc';
    
    // Update all headers to remove sort indicators
    table.querySelectorAll('th').forEach(header => {
        header.setAttribute('data-sort', '');
        const icon = header.querySelector('i.fas');
        if (icon) icon.className = 'fas fa-sort text-muted ms-1';
    });
    
    // Update current header with sort direction and indicator
    th.setAttribute('data-sort', currentDir);
    const icon = th.querySelector('i.fas');
    if (icon) {
        icon.className = currentDir === 'asc' 
            ? 'fas fa-sort-up ms-1' 
            : 'fas fa-sort-down ms-1';
    }
    
    // Sort the rows
    rows.sort((a, b) => {
        let aValue, bValue;
        
        // Special handling for the category column which contains an image and text
        if (columnIndex === 0) {
            aValue = a.cells[columnIndex].querySelector('.category-name')?.textContent.trim() || '';
            bValue = b.cells[columnIndex].querySelector('.category-name')?.textContent.trim() || '';
        } else {
            aValue = a.cells[columnIndex].textContent.trim();
            bValue = b.cells[columnIndex].textContent.trim();
        }
        
        // Check if values are numbers
        const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return currentDir === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Otherwise sort as strings
        return currentDir === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
    });
    
    // Reattach sorted rows to the table
    rows.forEach(row => tbody.appendChild(row));
}

// Setup action buttons
function setupActionButtons() {
    // Edit category buttons
    document.querySelectorAll('.action-button.edit').forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            // Redirect to edit page or open modal
            window.location.href = `/dashboard/categories/edit/${categoryId}`;
        });
    });
    
    // Toggle visibility buttons
    document.querySelectorAll('.action-button.visibility').forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            const currentStatus = this.getAttribute('data-status');
            toggleCategoryVisibility(categoryId, currentStatus);
        });
    });
    
    // Delete category buttons
    document.querySelectorAll('.action-button.delete').forEach(button => {
        button.addEventListener('click', function() {
            const categoryId = this.getAttribute('data-id');
            const categoryName = this.getAttribute('data-name');
            confirmDeleteCategory(categoryId, categoryName);
        });
    });
    
    // Add category button
    const addButton = document.querySelector('.add-category-btn');
    if (addButton) {
        addButton.addEventListener('click', function() {
            window.location.href = '/dashboard/categories/add';
        });
    }
}

// Toggle category visibility
function toggleCategoryVisibility(categoryId, currentStatus) {
    const newStatus = currentStatus === 'visible' ? 'hidden' : 'visible';
    
    // Here you would normally make an AJAX call to your API
    // For demonstration, we'll just show a success message
    console.log(`Category ${categoryId} visibility changed to ${newStatus}`);
    
    // Show a toast notification
    showToast(`Danh mục đã được ${newStatus === 'visible' ? 'hiển thị' : 'ẩn'} thành công.`);
    
    // Refresh the page or update the UI
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Confirm category deletion
function confirmDeleteCategory(categoryId, categoryName) {
    if (confirm(`Bạn có chắc chắn muốn xóa danh mục "${categoryName}"? Hành động này không thể hoàn tác.`)) {
        // Here you would normally make an AJAX call to your API
        // For demonstration, we'll just show a success message
        console.log(`Category ${categoryId} deleted`);
        
        // Show a toast notification
        showToast(`Danh mục "${categoryName}" đã được xóa thành công.`, 'danger');
        
        // Refresh the page or update the UI
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

// Initialize form validation for add/edit category forms
function initializeFormValidation() {
    const categoryForm = document.getElementById('categoryForm');
    if (!categoryForm) return;
    
    categoryForm.addEventListener('submit', function(event) {
        if (!validateCategoryForm()) {
            event.preventDefault();
            return false;
        }
    });
}

// Validate category form
function validateCategoryForm() {
    const categoryForm = document.getElementById('categoryForm');
    if (!categoryForm) return true;
    
    const nameInput = categoryForm.querySelector('input[name="name"]');
    if (!nameInput.value.trim()) {
        showToast('Tên danh mục không được để trống.', 'danger');
        nameInput.focus();
        return false;
    }
    
    return true;
}

// Show toast notification
function showToast(message, type = 'success') {
    // Check if the toast container exists, if not create it
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1050';
        document.body.appendChild(toastContainer);
    }
    
    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add the toast to the container
    toastContainer.appendChild(toast);
    
    // Initialize the Bootstrap toast and show it
    const bsToast = new bootstrap.Toast(toast, {
        delay: 5000
    });
    
    bsToast.show();
    
    // Remove the toast from the DOM when it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
} 