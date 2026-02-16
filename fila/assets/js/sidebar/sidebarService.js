/**
 * Sidebar Service
 * Manages sidebar navigation, active states, user info, and sidebar functionality
 */

(function() {
    'use strict';

    class SidebarService {
        constructor() {
            this.currentPage = this.getCurrentPage();
            this.init();
        }

        /**
         * Get current page name from URL
         */
        getCurrentPage() {
            const path = window.location.pathname;
            const page = path.split('/').pop() || 'index.html';
            return page;
        }

        /**
         * Initialize sidebar functionality
         */
        init() {
            this.setActiveMenuItem();
            this.updateUserInfo();
            this.initSearch();
            this.initSidebarToggle();
            this.initSettings();
        }

        /**
         * Set active menu item based on current page
         */
        setActiveMenuItem() {
            const currentPage = this.currentPage;
            
            // Remove all active classes
            document.querySelectorAll('.menu-link').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('open', 'active');
            });

            // Find and activate current page link
            const currentLink = document.querySelector(`a.menu-link[href="${currentPage}"]`);
            if (currentLink) {
                currentLink.classList.add('active');
                
                // Add active to parent menu-item
                let parentItem = currentLink.closest('.menu-item');
                if (parentItem) {
                    parentItem.classList.add('active', 'open');
                    
                    // Open parent menu-toggle if exists
                    const parentToggle = parentItem.parentElement.closest('.menu-item');
                    if (parentToggle) {
                        const toggleLink = parentToggle.querySelector('.menu-toggle');
                        if (toggleLink) {
                            parentToggle.classList.add('open', 'active');
                            toggleLink.classList.add('active');
                        }
                    }
                }
            }

            // Special handling for dashboard pages
            if (currentPage === 'index.html' || currentPage === 'analytics.html' || 
                currentPage === 'products-list.html' || currentPage === 'invoices.html' ||
                currentPage === 'reports.html' || currentPage === 'basic-elements.html') {
                // Activate Dashboard menu item
                const dashboardToggle = document.querySelector('a.menu-link[href="javascript:void(0);"] .title');
                if (dashboardToggle && dashboardToggle.textContent.trim() === 'Dashboard') {
                    const dashboardItem = dashboardToggle.closest('.menu-item');
                    if (dashboardItem) {
                        dashboardItem.classList.add('open', 'active');
                        const toggleLink = dashboardItem.querySelector('.menu-toggle');
                        if (toggleLink) {
                            toggleLink.classList.add('active');
                        }
                    }
                }
            }
        }

        /**
         * Update user information in sidebar header
         */
        updateUserInfo() {
            if (!window.authService) {
                // Retry after a short delay if authService not loaded yet
                setTimeout(() => this.updateUserInfo(), 500);
                return;
            }

            const user = window.authService.getCurrentUser();
            const tenant = window.authService.getCurrentTenant();

            if (user) {
                const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                const userRole = user.role || 'User';

                // Update user name in header dropdown (multiple selectors)
                document.querySelectorAll('.user-name, h3.user-name, .info h3, .admin-profile .info h3').forEach(el => {
                    if (el.classList.contains('user-name') || el.tagName === 'H3') {
                        el.textContent = userName;
                    }
                });

                // Update user email
                document.querySelectorAll('.user-email').forEach(el => {
                    el.textContent = user.email;
                });

                // Update role badge
                document.querySelectorAll('.user-role, .info span.fs-15, .admin-profile .info span').forEach(el => {
                    if (el.classList.contains('user-role') || 
                        (el.tagName === 'SPAN' && (el.textContent.includes('Loading') || el.textContent === 'Admin' || el.textContent === 'User'))) {
                        el.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
                        // Add badge class if it's a badge element
                        if (el.classList.contains('role-badge')) {
                            el.className = `badge bg-${userRole === 'admin' ? 'primary' : 'secondary'} user-role`;
                        }
                    }
                });

                // Update company name in logo area (optional - keep Cloudignite for branding)
                // You can customize this if you want to show company name
            } else {
                // User not logged in, show default
                document.querySelectorAll('.user-name').forEach(el => {
                    el.textContent = 'Guest';
                });
                document.querySelectorAll('.user-role').forEach(el => {
                    el.textContent = 'Not logged in';
                });
            }
        }

        /**
         * Initialize sidebar search functionality
         */
        initSearch() {
            const searchInput = document.querySelector('#sidebar-search, input[placeholder*="Search"], input[placeholder*="search"]');
            if (!searchInput) return;

            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                this.filterMenuItems(searchTerm);
            });

            // Clear search on escape
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.filterMenuItems('');
                }
            });
        }

        /**
         * Filter menu items based on search term
         */
        filterMenuItems(searchTerm) {
            const menuItems = document.querySelectorAll('.menu-item:not(.menu-title)');
            
            if (!searchTerm) {
                // Show all items
                menuItems.forEach(item => {
                    item.style.display = '';
                });
                return;
            }

            menuItems.forEach(item => {
                const link = item.querySelector('.menu-link');
                const title = link ? link.querySelector('.title')?.textContent.toLowerCase() : '';
                const icon = link ? link.querySelector('.menu-icon')?.textContent.toLowerCase() : '';
                
                const matches = title.includes(searchTerm) || icon.includes(searchTerm);
                item.style.display = matches ? '' : 'none';
            });
        }

        /**
         * Initialize sidebar toggle (show/hide)
         */
        initSidebarToggle() {
            // Burger menu toggle
            const burgerMenu = document.getElementById('sidebar-burger-menu');
            if (burgerMenu) {
                burgerMenu.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Close button toggle
            const closeButton = document.getElementById('sidebar-burger-menu-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }

            // Header burger menu (if exists)
            const headerBurger = document.getElementById('header-burger-menu');
            if (headerBurger) {
                headerBurger.addEventListener('click', () => {
                    this.toggleSidebar();
                });
            }
        }

        /**
         * Toggle sidebar visibility
         */
        toggleSidebar() {
            const currentTheme = document.body.getAttribute('sidebar-data-theme');
            if (currentTheme === 'sidebar-hide') {
                document.body.setAttribute('sidebar-data-theme', 'sidebar-show');
            } else {
                document.body.setAttribute('sidebar-data-theme', 'sidebar-hide');
            }
        }

        /**
         * Initialize sidebar settings (dark mode, RTL, etc.)
         */
        initSettings() {
            // Load saved settings from localStorage
            this.loadSettings();

            // Dark mode toggle is handled in custom.js (single handler on #switch-toggle to avoid double-toggle)

            // RTL mode toggle (if exists)
            const rtlToggle = document.querySelector('[data-rtl="true"], .rtl-toggle');
            if (rtlToggle) {
                rtlToggle.addEventListener('click', () => {
                    this.toggleRTL();
                });
            }
        }

        /**
         * Load saved settings from localStorage
         */
        loadSettings() {
            // Dark mode
            const darkMode = localStorage.getItem('sidebar-dark-mode') === 'true';
            if (darkMode) {
                document.body.setAttribute('data-theme', 'dark');
            }

            // RTL mode
            const rtlMode = localStorage.getItem('sidebar-rtl-mode') === 'true';
            if (rtlMode) {
                document.documentElement.setAttribute('dir', 'rtl');
            }

            // Sidebar state
            const sidebarState = localStorage.getItem('sidebar-state');
            if (sidebarState) {
                document.body.setAttribute('sidebar-data-theme', sidebarState);
            }
        }

        /**
         * Toggle dark mode
         */
        toggleDarkMode() {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('sidebar-dark-mode', newTheme === 'dark');
        }

        /**
         * Toggle RTL mode
         */
        toggleRTL() {
            const currentDir = document.documentElement.getAttribute('dir');
            const newDir = currentDir === 'rtl' ? 'ltr' : 'rtl';
            document.documentElement.setAttribute('dir', newDir);
            localStorage.setItem('sidebar-rtl-mode', newDir === 'rtl');
        }

        /**
         * Update notification counts (for badges)
         */
        updateNotificationCounts() {
            // This can be called to update notification badges
            // Example: Update email count, file count, etc.
            if (window.apiService) {
                // You can fetch real counts from API here
                // For now, this is a placeholder
            }
        }

        /**
         * Refresh sidebar (re-initialize)
         */
        refresh() {
            this.currentPage = this.getCurrentPage();
            this.setActiveMenuItem();
            this.updateUserInfo();
        }
    }

    // Initialize when DOM is ready
    function initSidebar() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.sidebarService = new SidebarService();
            });
        } else {
            window.sidebarService = new SidebarService();
        }
    }

    initSidebar();

    // Also refresh when auth state changes
    if (window.authService) {
        // Refresh sidebar when user info is updated
        const originalSetAuthData = window.authService.setAuthData;
        if (originalSetAuthData) {
            window.authService.setAuthData = function(...args) {
                originalSetAuthData.apply(this, args);
                if (window.sidebarService) {
                    window.sidebarService.updateUserInfo();
                }
            };
        }
    }
})();
