// Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize revenue chart
    initializeRevenueChart();
    
    // Set active navigation based on current page
    setActiveNavigation();
    
    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl)
    });

    // Initialize charts if they exist on the page
    initializeCharts();
});

// Set active navigation based on current URL
function setActiveNavigation() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item a');
    
    navLinks.forEach(link => {
        if (currentPath === link.getAttribute('href') || 
            (link.getAttribute('href') !== '/dashboard' && currentPath.startsWith(link.getAttribute('href')))) {
            link.parentElement.classList.add('active');
        } else {
            link.parentElement.classList.remove('active');
        }
    });
}

// Initialize revenue chart
function initializeRevenueChart() {
    const chartElement = document.getElementById('revenueChart');
    if (!chartElement) return;
    
    // Define chart data
    const labels = ['01 Apr', '02 Apr', '03 Apr', '04 Apr', '05 Apr', '06 Apr', '07 Apr'];
    const data = [240, 280, 200, 220, 260, 230, 300];
    
    // Define chart options
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#212529',
                bodyColor: '#212529',
                borderColor: '#e9ecef',
                borderWidth: 1,
                cornerRadius: 4,
                displayColors: true,
                boxPadding: 4,
                usePointStyle: true,
                callbacks: {
                    label: function(context) {
                        return `Sales: ${context.raw}k`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#6c757d'
                }
            },
            y: {
                position: 'left',
                beginAtZero: true,
                grid: {
                    color: '#e9ecef'
                },
                ticks: {
                    color: '#6c757d',
                    callback: function(value) {
                        return value + 'k';
                    }
                }
            }
        },
        elements: {
            line: {
                tension: 0.4,
                borderWidth: 2,
                borderColor: '#3262e7',
                fill: false
            },
            point: {
                radius: 3,
                hitRadius: 10,
                hoverRadius: 5,
                backgroundColor: '#3262e7',
                borderColor: '#fff',
                borderWidth: 2,
                hoverBorderWidth: 2
            }
        }
    };
    
    // Create the chart
    const revenueChart = new Chart(chartElement, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sales',
                data: data,
                backgroundColor: 'rgba(50, 98, 231, 0.1)',
                borderColor: '#3262e7',
                pointBackgroundColor: '#3262e7',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#3262e7',
                fill: true
            }]
        },
        options: options
    });
    
    // Add a tooltip annotation for 2 Apr (79k)
    const tooltipIndicator = document.createElement('div');
    tooltipIndicator.className = 'tooltip-indicator';
    tooltipIndicator.innerHTML = `
        <div class="tooltip-dot"></div>
        <div class="tooltip-content">
            <div class="tooltip-date">2 Apr, 2021</div>
            <div class="tooltip-value">Sales: $79k</div>
        </div>
    `;
    
    // Position the tooltip at the second data point (index 1)
    const chartWrapper = document.querySelector('.chart-wrapper');
    if (chartWrapper) {
        chartWrapper.appendChild(tooltipIndicator);
        
        // Style the tooltip indicator
        const style = document.createElement('style');
        style.textContent = `
            .chart-wrapper {
                position: relative;
            }
            
            .tooltip-indicator {
                position: absolute;
                top: 70px;
                left: 35%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .tooltip-dot {
                width: 10px;
                height: 10px;
                background-color: #3262e7;
                border: 2px solid #fff;
                border-radius: 50%;
                box-shadow: 0 0 0 1px #3262e7;
            }
            
            .tooltip-content {
                background-color: #fff;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                padding: 8px 12px;
                margin-top: 5px;
                font-size: 12px;
                color: #212529;
                white-space: nowrap;
            }
            
            .tooltip-date {
                font-weight: 500;
                margin-bottom: 2px;
            }
            
            .tooltip-value {
                color: #3262e7;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize dashboard charts
function initializeCharts() {
    // Sales Overview Chart
    const salesChartEl = document.getElementById('salesChart');
    if (salesChartEl) {
        const salesChart = new Chart(salesChartEl, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Sales',
                    data: [12, 19, 3, 5, 2, 3, 20, 33, 23, 12, 33, 55],
                    backgroundColor: 'rgba(13, 110, 253, 0.2)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 2,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Monthly Sales Overview'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Product Categories Chart
    const categoriesChartEl = document.getElementById('categoriesChart');
    if (categoriesChartEl) {
        const categoriesChart = new Chart(categoriesChartEl, {
            type: 'doughnut',
            data: {
                labels: ['Furniture', 'Decor', 'Lighting', 'Kitchen', 'Textiles'],
                datasets: [{
                    label: 'Products by Category',
                    data: [42, 23, 15, 8, 12],
                    backgroundColor: [
                        'rgba(13, 110, 253, 0.7)',
                        'rgba(25, 135, 84, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(220, 53, 69, 0.7)',
                        'rgba(13, 202, 240, 0.7)'
                    ],
                    borderColor: [
                        'rgba(13, 110, 253, 1)',
                        'rgba(25, 135, 84, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)',
                        'rgba(13, 202, 240, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Products by Category'
                    }
                }
            }
        });
    }
}

// Handle data table sorting
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
        header.querySelector('i.sort-indicator')?.remove();
    });
    
    // Update current header with sort direction and indicator
    th.setAttribute('data-sort', currentDir);
    
    const icon = document.createElement('i');
    icon.className = currentDir === 'asc' 
        ? 'fas fa-sort-up sort-indicator ms-1' 
        : 'fas fa-sort-down sort-indicator ms-1';
    th.appendChild(icon);
    
    // Sort the rows
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();
        
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

// Function to confirm delete actions
function confirmDelete(itemType, itemId) {
    return confirm(`Are you sure you want to delete this ${itemType}? This action cannot be undone.`);
}

// Function to show toast notifications
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '1050';
        document.body.appendChild(container);
    }
    
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
    
    document.getElementById('toastContainer').appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        delay: 5000
    });
    
    bsToast.show();
    
    // Remove the toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
} 