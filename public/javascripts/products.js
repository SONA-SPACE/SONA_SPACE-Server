// Products Management JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // Initialize table sorting
  initializeSorting();

  // Initialize checkbox selection
  initializeCheckboxes();

  // Add event listeners for action buttons
  setupActionButtons();
});

// Initialize table sorting functionality
function initializeSorting() {
  const table = document.getElementById("productsTable");
  if (!table) return;

  const headerCells = table.querySelectorAll('th[data-sortable="true"]');
  headerCells.forEach((cell) => {
    cell.addEventListener("click", function () {
      const columnIndex = Array.from(cell.parentNode.children).indexOf(cell);
      sortTable("productsTable", columnIndex);
    });

    // Add sort indicator and cursor style
    cell.style.cursor = "pointer";
    cell.innerHTML += ' <i class="fas fa-sort text-muted ms-1"></i>';
  });
}

// Sort table function
function sortTable(tableId, columnIndex) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // Get the current sort direction
  const th = table.querySelectorAll("th")[columnIndex];
  const currentDir = th.getAttribute("data-sort") === "asc" ? "desc" : "asc";

  // Update all headers to remove sort indicators
  table.querySelectorAll("th").forEach((header) => {
    header.setAttribute("data-sort", "");
    const icon = header.querySelector("i.fas");
    if (icon) icon.className = "fas fa-sort text-muted ms-1";
  });

  // Update current header with sort direction and indicator
  th.setAttribute("data-sort", currentDir);
  const icon = th.querySelector("i.fas");
  if (icon) {
    icon.className =
      currentDir === "asc" ? "fas fa-sort-up ms-1" : "fas fa-sort-down ms-1";
  }

  // Sort the rows
  rows.sort((a, b) => {
    let aValue, bValue;

    // Special handling for the product column which contains an image and text
    if (columnIndex === 1) {
      aValue =
        a.cells[columnIndex]
          .querySelector(".product-name")
          ?.textContent.trim() || "";
      bValue =
        b.cells[columnIndex]
          .querySelector(".product-name")
          ?.textContent.trim() || "";
    }
    // Special handling for price column
    else if (columnIndex === 3) {
      aValue =
        a.cells[columnIndex].querySelector(".sale-price")?.textContent.trim() ||
        "";
      bValue =
        b.cells[columnIndex].querySelector(".sale-price")?.textContent.trim() ||
        "";
    } else {
      aValue = a.cells[columnIndex].textContent.trim();
      bValue = b.cells[columnIndex].textContent.trim();
    }

    // Check if values are numbers
    const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ""));
    const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ""));

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return currentDir === "asc" ? aNum - bNum : bNum - aNum;
    }

    // Otherwise sort as strings
    return currentDir === "asc"
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  // Reattach sorted rows to the table
  rows.forEach((row) => tbody.appendChild(row));
}

// Initialize checkbox selection
function initializeCheckboxes() {
  const selectAllCheckbox = document.getElementById("selectAll");
  if (!selectAllCheckbox) return;

  const checkboxes = document.querySelectorAll(
    '.product-table .checkbox-cell input[type="checkbox"]'
  );

  // Select/deselect all checkboxes
  selectAllCheckbox.addEventListener("change", function () {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = this.checked;
    });
    updateSelectedCount();
  });

  // Update "select all" checkbox when individual checkboxes change
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      updateSelectedCount();

      const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
      const someChecked = Array.from(checkboxes).some((cb) => cb.checked);

      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    });
  });
}

// Update the count of selected items
function updateSelectedCount() {
  const checkboxes = document.querySelectorAll(
    '.product-table .checkbox-cell input[type="checkbox"]:checked'
  );
  const count =
    checkboxes.length -
    (document.querySelector('th input[type="checkbox"]:checked') ? 1 : 0);

  // Here you could update UI to show selected count or enable bulk actions
}

// Setup action buttons
function setupActionButtons() {
  // Edit product buttons
  document.querySelectorAll(".action-button.edit").forEach((button) => {
    button.addEventListener("click", function () {
      const productId = this.getAttribute("data-id");
      // Redirect to edit page or open modal
      window.location.href = `/dashboard/products/edit/${productId}`;
    });
  });

  // Toggle visibility buttons
  document.querySelectorAll(".action-button.visibility").forEach((button) => {
    button.addEventListener("click", function () {
      const productId = this.getAttribute("data-id");
      const currentStatus = this.getAttribute("data-status");
      toggleProductVisibility(productId, currentStatus);
    });
  });

  // Delete product buttons
  document.querySelectorAll(".action-button.delete").forEach((button) => {
    button.addEventListener("click", function () {
      const productId = this.getAttribute("data-id");
      const productName = this.getAttribute("data-name");
      confirmDeleteProduct(productId, productName);
    });
  });

  // Add product button
  const addButton = document.querySelector(".add-product-btn");
  if (addButton) {
    addButton.addEventListener("click", function () {
      window.location.href = "/dashboard/products/add";
    });
  }

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", function () {
      // In a real application, you would show a dropdown here
    });
  });
}

// Toggle product visibility
function toggleProductVisibility(productId, currentStatus) {
  const newStatus = currentStatus === "visible" ? "hidden" : "visible";

  // Here you would normally make an AJAX call to your API
  // For demonstration, we'll just show a success message
  // Show a toast notification
  showToast(
    `Sản phẩm đã được ${
      newStatus === "visible" ? "hiển thị" : "ẩn"
    } thành công.`
  );

  // Refresh the page or update the UI
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Confirm product deletion
function confirmDeleteProduct(productId, productName) {
  if (
    confirm(
      `Bạn có chắc chắn muốn xóa sản phẩm "${productName}"? Hành động này không thể hoàn tác.`
    )
  ) {
    // Here you would normally make an AJAX call to your API
    // For demonstration, we'll just show a success message
    // Show a toast notification
    showToast(`Sản phẩm "${productName}" đã được xóa thành công.`, "danger");

    // Refresh the page or update the UI
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}

// Show toast notification
function showToast(message, type = "success") {
  // Check if the toast container exists, if not create it
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "1050";
    document.body.appendChild(toastContainer);
  }

  // Create the toast element
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");

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
    delay: 5000,
  });

  bsToast.show();

  // Remove the toast from the DOM when it's hidden
  toast.addEventListener("hidden.bs.toast", function () {
    toast.remove();
  });
}
