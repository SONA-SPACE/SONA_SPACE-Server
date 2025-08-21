// Product Form JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize file upload components
    initializeFileUploads();
    
    // Initialize color selector
    initializeColorSelector();
    
    // Setup form validation
    setupFormValidation();
    
    // Setup form actions (save, cancel)
    setupFormActions();
});

// Initialize file upload functionality
function initializeFileUploads() {
    // Main upload area
    const mainUploadArea = document.querySelector('.main-upload-area');
    if (mainUploadArea) {
        mainUploadArea.addEventListener('click', function() {
            createFileInput(function(file) {
                // Here you would handle the main image upload
                // Preview the image
                previewMainImage(file);
            });
        });
        
        // Setup drag and drop
        setupDragAndDrop(mainUploadArea, function(file) {
            previewMainImage(file);
        });
    }
    
    // Thumbnail upload items
    const thumbnailItems = document.querySelectorAll('.thumbnail-upload-item');
    thumbnailItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            createFileInput(function(file) {
                // Here you would handle the thumbnail image upload
                // Preview the thumbnail
                previewThumbnail(file, item);
            });
        });
        
        // Setup drag and drop for each thumbnail
        setupDragAndDrop(item, function(file) {
            previewThumbnail(file, item);
        });
    });
}

// Create a temporary file input element
function createFileInput(onFileSelected) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.style.display = 'none';
    
    input.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            onFileSelected(this.files[0]);
        }
        // Remove the input after selection
        document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
}

// Setup drag and drop functionality
function setupDragAndDrop(element, onFileDrop) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        element.addEventListener(eventName, function() {
            element.classList.add('highlight');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, function() {
            element.classList.remove('highlight');
        }, false);
    });
    
    element.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        
        if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
            onFileDrop(file);
        } else {
            showToast('Chỉ chấp nhận file hình ảnh định dạng JPEG hoặc PNG', 'warning');
        }
    }, false);
}

// Preview main image
function previewMainImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const mainUploadArea = document.querySelector('.main-upload-area');
        
        // Clear previous content
        mainUploadArea.innerHTML = '';
        
        // Create image element
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.borderRadius = '4px';
        
        mainUploadArea.appendChild(img);
    };
    reader.readAsDataURL(file);
}

// Preview thumbnail image
function previewThumbnail(file, thumbnailElement) {
    const reader = new FileReader();
    reader.onload = function(e) {
        // Clear previous content
        thumbnailElement.innerHTML = '';
        
        // Create image element
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        
        thumbnailElement.appendChild(img);
    };
    reader.readAsDataURL(file);
}

// Initialize color selector functionality
function initializeColorSelector() {
    const colorSelect = document.getElementById('productColor');
    const colorCircle = document.querySelector('.color-circle');
    
    if (colorSelect && colorCircle) {
        // Initialize with the first color
        updateColorPreview();
        
        // Update color when selection changes
        colorSelect.addEventListener('change', updateColorPreview);
        
        function updateColorPreview() {
            const colorValue = colorSelect.value;
            let hexColor = '#8B4513'; // Default brown
            
            // Map color names to hex values
            switch(colorValue) {
                case 'red':
                    hexColor = '#DC3545';
                    break;
                case 'brown':
                    hexColor = '#8B4513';
                    break;
                case 'black':
                    hexColor = '#000000';
                    break;
                case 'white':
                    hexColor = '#FFFFFF';
                    break;
                case 'gray':
                    hexColor = '#6C757D';
                    break;
            }
            
            colorCircle.style.backgroundColor = hexColor;
        }
    }
}

// Setup form validation
function setupFormValidation() {
    const form = document.querySelector('.product-form-column');
    if (!form) return;
    
    const requiredFields = [
        { id: 'productName', message: 'Tên sản phẩm không được để trống' },
        { id: 'productCategory', message: 'Vui lòng chọn danh mục sản phẩm' },
        { id: 'productQuantity', message: 'Số lượng không được để trống' },
        { id: 'productStatus', message: 'Vui lòng chọn trạng thái' },
        { id: 'originalPrice', message: 'Giá gốc không được để trống' }
    ];
    
    // Validate on save button click
    const saveButton = document.querySelector('.btn-save');
    if (saveButton) {
        saveButton.addEventListener('click', function() {
            if (validateForm(requiredFields)) {
                // Proceed with saving the product
                // In a real app, you would submit the form or make an API call
                showToast('Sản phẩm đã được lưu thành công', 'success');
                
                // Redirect after a delay
                setTimeout(() => {
                    window.location.href = '/dashboard/products';
                }, 1500);
            }
        });
    }
}

// Validate the form
function validateForm(requiredFields) {
    let isValid = true;
    
    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) return;
        
        const value = element.value.trim();
        if (!value) {
            isValid = false;
            element.classList.add('is-invalid');
            showToast(field.message, 'danger');
            
            // Remove invalid class on input
            element.addEventListener('input', function() {
                element.classList.remove('is-invalid');
            }, { once: true });
        }
    });
    
    return isValid;
}

// Setup form actions
function setupFormActions() {
    // Cancel button
    const cancelButton = document.querySelector('.btn-cancel');
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            if (confirm('Bạn có chắc muốn hủy? Mọi thông tin chưa lưu sẽ bị mất.')) {
                window.location.href = '/dashboard/products';
            }
        });
    }
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