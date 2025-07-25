// Dashboard JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // Set active navigation based on current page
  setActiveNavigation();

  // Initialize tooltips if Bootstrap is available
  if (typeof bootstrap !== "undefined") {
    var tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Initialize popovers
  var popoverTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]')
  );
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});

// Set active navigation based on current URL
function setActiveNavigation() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-item a");

  navLinks.forEach((link) => {
    if (
      currentPath === link.getAttribute("href") ||
      (link.getAttribute("href") !== "/dashboard" &&
        currentPath.startsWith(link.getAttribute("href")))
    ) {
      link.parentElement.classList.add("active");
    } else {
      link.parentElement.classList.remove("active");
    }
  });
}

// Handle data table sorting
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
    header.querySelector("i.sort-indicator")?.remove();
  });

  // Update current header with sort direction and indicator
  th.setAttribute("data-sort", currentDir);

  const icon = document.createElement("i");
  icon.className =
    currentDir === "asc"
      ? "fas fa-sort-up sort-indicator ms-1"
      : "fas fa-sort-down sort-indicator ms-1";
  th.appendChild(icon);

  // Sort the rows
  rows.sort((a, b) => {
    const aValue = a.cells[columnIndex].textContent.trim();
    const bValue = b.cells[columnIndex].textContent.trim();

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

// Function to confirm delete actions
function confirmDelete(itemType, itemId) {
  return confirm(
    `Are you sure you want to delete this ${itemType}? This action cannot be undone.`
  );
}

// Function to show toast notifications
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    // Create toast container if it doesn't exist
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "position-fixed top-0 end-0 p-3";
    container.style.zIndex = "1050";
    document.body.appendChild(container);
  }

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

  document.getElementById("toastContainer").appendChild(toast);

  const bsToast = new bootstrap.Toast(toast, {
    delay: 5000,
  });

  bsToast.show();

  // Remove the toast after it's hidden
  toast.addEventListener("hidden.bs.toast", function () {
    toast.remove();
  });
}
