/**
 * Main JavaScript file for School Management System
 * Handles common functionality across all pages
 */

// Global variables
let currentUser = null;
let notifications = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    initializeTooltips();
    initializeModals();
    checkUserSession();
});

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing School Management System...');
    
    // Add loading states to forms
    setupFormLoadingStates();
    
    // Setup CSRF protection if needed
    setupCSRFProtection();
    
    // Initialize data tables if present
    initializeDataTables();
    
    // Setup auto-refresh for certain data
    setupAutoRefresh();
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Handle form submissions with loading states
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });
    
    // Handle modal events
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('show.bs.modal', handleModalShow);
        modal.addEventListener('hidden.bs.modal', handleModalHidden);
    });
    
    // Handle search inputs with debounce
    document.querySelectorAll('input[type="search"], input[name="search"]').forEach(input => {
        input.addEventListener('input', debounce(handleSearchInput, 300));
    });
    
    // Handle notification dismissal
    document.querySelectorAll('.alert .btn-close').forEach(button => {
        button.addEventListener('click', handleNotificationDismiss);
    });
    
    // Handle sidebar toggle on mobile
    const sidebarToggle = document.querySelector('[data-bs-toggle="sidebar"]');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Initialize Bootstrap modals
 */
function initializeModals() {
    // Auto-focus first input in modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('shown.bs.modal', function() {
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) {
                firstInput.focus();
            }
        });
    });
}

/**
 * Check user session and update UI accordingly
 */
function checkUserSession() {
    // This would typically check with the server
    // For now, we'll use the session data from templates
    const userInfo = document.querySelector('.navbar .dropdown-toggle');
    if (userInfo) {
        currentUser = {
            name: userInfo.textContent.trim(),
            role: document.body.dataset.userRole || 'unknown'
        };
    }
}

/**
 * Handle form submissions with loading states
 */
function handleFormSubmit(event) {
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    if (submitButton) {
        // Add loading state
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        
        // Store original text
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processando...';
        
        // Remove loading state after a delay (form will submit)
        setTimeout(() => {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.innerHTML = originalText;
        }, 2000);
    }
}

/**
 * Handle modal show events
 */
function handleModalShow(event) {
    const modal = event.target;
    modal.classList.add('fade-in');
}

/**
 * Handle modal hidden events
 */
function handleModalHidden(event) {
    const modal = event.target;
    modal.classList.remove('fade-in');
    
    // Clear form data if it's a form modal
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        clearFormValidation(form);
    }
}

/**
 * Handle search input with debounce
 */
function handleSearchInput(event) {
    const input = event.target;
    const searchTerm = input.value.trim();
    
    // You could implement real-time search here
    console.log('Search term:', searchTerm);
    
    // For now, we'll just highlight the search term
    highlightSearchTerm(searchTerm);
}

/**
 * Handle notification dismissal
 */
function handleNotificationDismiss(event) {
    const alert = event.target.closest('.alert');
    if (alert) {
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }
}

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
}

/**
 * Setup form loading states
 */
function setupFormLoadingStates() {
    document.querySelectorAll('form').forEach(form => {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.addEventListener('click', function() {
                // Validate form before showing loading state
                if (form.checkValidity()) {
                    this.classList.add('loading');
                }
            });
        }
    });
}

/**
 * Setup CSRF protection for AJAX requests
 */
function setupCSRFProtection() {
    // Get CSRF token from meta tag or form
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                     document.querySelector('input[name="csrf_token"]')?.value;
    
    if (csrfToken) {
        // Set default headers for fetch requests
        window.csrfToken = csrfToken;
    }
}

/**
 * Initialize data tables with sorting and pagination
 */
function initializeDataTables() {
    document.querySelectorAll('.table').forEach(table => {
        // Add sorting capability to table headers
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            if (header.textContent.trim() && !header.querySelector('.no-sort')) {
                header.style.cursor = 'pointer';
                header.addEventListener('click', () => sortTable(table, index));
            }
        });
    });
}

/**
 * Setup auto-refresh for certain data
 */
function setupAutoRefresh() {
    // Refresh notifications every 5 minutes
    if (document.querySelector('.notification-area')) {
        setInterval(refreshNotifications, 5 * 60 * 1000);
    }
    
    // Refresh dashboard stats every 2 minutes
    if (document.querySelector('.dashboard')) {
        setInterval(refreshDashboardStats, 2 * 60 * 1000);
    }
}

/**
 * Sort table by column
 */
function sortTable(table, columnIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    const isNumeric = rows.every(row => {
        const cell = row.cells[columnIndex];
        return cell && !isNaN(cell.textContent.trim());
    });
    
    rows.sort((a, b) => {
        const aText = a.cells[columnIndex]?.textContent.trim() || '';
        const bText = b.cells[columnIndex]?.textContent.trim() || '';
        
        if (isNumeric) {
            return parseFloat(aText) - parseFloat(bText);
        } else {
            return aText.localeCompare(bText, 'pt-BR');
        }
    });
    
    // Toggle sort direction
    const header = table.querySelectorAll('th')[columnIndex];
    const isAscending = header.classList.contains('sort-desc');
    
    if (isAscending) {
        rows.reverse();
        header.classList.remove('sort-desc');
        header.classList.add('sort-asc');
    } else {
        header.classList.remove('sort-asc');
        header.classList.add('sort-desc');
    }
    
    // Clear other headers
    table.querySelectorAll('th').forEach(th => {
        if (th !== header) {
            th.classList.remove('sort-asc', 'sort-desc');
        }
    });
    
    // Reorder rows
    rows.forEach(row => tbody.appendChild(row));
}

/**
 * Highlight search terms in results
 */
function highlightSearchTerm(term) {
    if (!term) return;
    
    const results = document.querySelectorAll('.table tbody tr');
    results.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            const text = cell.textContent;
            if (text.toLowerCase().includes(term.toLowerCase())) {
                row.style.backgroundColor = 'var(--bs-warning-bg-subtle)';
            } else {
                row.style.backgroundColor = '';
            }
        });
    });
}

/**
 * Clear form validation states
 */
function clearFormValidation(form) {
    form.querySelectorAll('.is-invalid').forEach(element => {
        element.classList.remove('is-invalid');
    });
    
    form.querySelectorAll('.invalid-feedback').forEach(element => {
        element.style.display = 'none';
    });
}

/**
 * Refresh notifications
 */
async function refreshNotifications() {
    try {
        // This would typically fetch from an API endpoint
        console.log('Refreshing notifications...');
        // const response = await fetch('/api/notifications');
        // const notifications = await response.json();
        // updateNotificationUI(notifications);
    } catch (error) {
        console.error('Error refreshing notifications:', error);
    }
}

/**
 * Refresh dashboard statistics
 */
async function refreshDashboardStats() {
    try {
        console.log('Refreshing dashboard stats...');
        // This would typically fetch updated stats from the server
        // const response = await fetch('/api/dashboard-stats');
        // const stats = await response.json();
        // updateDashboardStatsUI(stats);
    } catch (error) {
        console.error('Error refreshing dashboard stats:', error);
    }
}

/**
 * Utility function: Debounce
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Utility function: Show toast notification
 */
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

/**
 * Create toast container if it doesn't exist
 */
function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
}

/**
 * Utility function: Confirm action
 */
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

/**
 * Utility function: Format date to Brazilian format
 */
function formatDateBR(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

/**
 * Utility function: Format time to Brazilian format
 */
function formatTimeBR(time) {
    if (typeof time === 'string' && time.includes(':')) {
        return time.substring(0, 5); // HH:MM
    }
    
    if (time instanceof Date) {
        return time.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return time;
}

/**
 * Export functions for use in other scripts
 */
window.SchoolSystem = {
    showToast,
    confirmAction,
    formatDateBR,
    formatTimeBR,
    debounce
};
