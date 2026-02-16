/**
 * Authentication Helper
 * Provides common authentication functions for all pages
 */

(function() {
    'use strict';

    /**
     * Initialize authentication on page load
     * - Verifies user is authenticated
     * - Updates logout links
     * - Redirects to login if not authenticated
     */
    function initAuth() {
        // Wait for authService to be loaded
        if (typeof window.authService === 'undefined') {
            // If authService is not loaded, try loading it
            const script = document.createElement('script');
            script.src = 'assets/js/auth/authService.js';
            script.onload = function() {
                checkAuthAndUpdateLinks();
            };
            document.head.appendChild(script);
        } else {
            checkAuthAndUpdateLinks();
        }
    }

    /**
     * Check authentication and update logout links
     */
    function checkAuthAndUpdateLinks() {
        // Check if user is authenticated
        if (window.authService) {
            // If token exists but is invalid, clear it
            const token = window.authService.getToken();
            if (token) {
                try {
                    // Try to decode token to check if it's valid format
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    // If token exists but authService says not authenticated, clear it
                    if (!window.authService.isAuthenticated()) {
                        console.warn('⚠️ Invalid token detected, clearing...');
                        window.authService.clearAuthData();
                        const currentPage = window.location.pathname.split('/').pop();
                        if (currentPage !== 'sign-in.html' && currentPage !== 'sign-up.html') {
                            window.location.href = 'sign-in.html';
                            return;
                        }
                    }
                } catch (e) {
                    // Invalid token format, clear it
                    console.warn('⚠️ Invalid token format, clearing...');
                    window.authService.clearAuthData();
                    const currentPage = window.location.pathname.split('/').pop();
                    if (currentPage !== 'sign-in.html' && currentPage !== 'sign-up.html') {
                        window.location.href = 'sign-in.html';
                        return;
                    }
                }
            }
            
            if (!window.authService.isAuthenticated()) {
                // Only redirect if not on login/signup pages
                const currentPage = window.location.pathname.split('/').pop();
                if (currentPage !== 'sign-in.html' && currentPage !== 'sign-up.html') {
                    window.location.href = 'sign-in.html';
                    return;
                }
            }
        }

        // Update all logout links
        updateLogoutLinks();
    }

    /**
     * Update all logout links to use authService.logout()
     */
    function updateLogoutLinks() {
        // Find all links to logout.html
        const logoutLinks = document.querySelectorAll('a[href="logout.html"], a[href*="logout.html"]');
        
        logoutLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                if (window.authService) {
                    window.authService.logout();
                } else {
                    // Fallback: clear localStorage and redirect
                    localStorage.clear();
                    window.location.href = 'sign-in.html';
                }
                return false;
            });
            
            // Update href to prevent navigation
            link.setAttribute('href', '#');
        });

        // Also find logout links in dropdown menus
        const logoutDropdownLinks = document.querySelectorAll('a[href*="logout"]');
        logoutDropdownLinks.forEach(link => {
            if (link.textContent.toLowerCase().includes('logout') || 
                link.querySelector('.material-symbols-outlined, i')?.textContent.includes('logout')) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (window.authService) {
                        window.authService.logout();
                    } else {
                        localStorage.clear();
                        window.location.href = 'sign-in.html';
                    }
                    return false;
                });
                link.setAttribute('href', '#');
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuth);
    } else {
        initAuth();
    }

    // Also run after a short delay to catch dynamically loaded content
    setTimeout(updateLogoutLinks, 1000);
})();
