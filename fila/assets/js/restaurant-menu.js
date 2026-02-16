/**
 * Restaurant-only navigation configuration for Cloudignite.
 * Reference only: sidebar HTML is inline in core/*.html; this object documents the structure.
 * Use apply-restaurant-menu.js to sync sidebar content across core pages.
 */
const restaurantMenu = {
  MAIN: [
    { icon: 'visibility', text: 'Owner View', link: 'owner-view.html', id: 'nav-owner-view' },
    { icon: 'dashboard', text: 'Loss Summary', link: 'index.html' },
    { icon: 'inventory_2', text: 'Inventory Control', link: 'products-list.html' },
    { icon: 'fact_check', text: 'Weekly Count', link: 'inventory-count.html' },
    { icon: 'delete', text: 'Waste Tracking', link: 'analytics.html' },
    { icon: 'groups', text: 'Labor Cost Analysis', link: 'reports.html' },
    { icon: 'restaurant_menu', text: 'Menu Profitability', link: 'products-list.html' },
    { icon: 'local_shipping', text: 'Suppliers & Invoices', link: 'invoices.html' },
    { icon: 'warning', text: 'Variance Detection', link: 'analytics.html' },
    { icon: 'task_alt', text: 'Action Items', link: 'analytics.html' },
    { icon: 'edit_note', text: 'Manual Data Entry', link: 'manual-data-entry.html' },
    { icon: 'assessment', text: 'Reports & Exports', link: 'reports.html' },
    { icon: 'notifications', text: 'Alerts', link: 'alerts.html' }
  ],
  SETTINGS: [
    {
      icon: 'settings',
      text: 'Settings',
      sub: [
        { text: 'Account Settings', link: 'account-settings.html' },
        { text: 'Change Password', link: 'change-password.html' },
        { text: 'Restaurant Settings', link: 'settings.html' }
      ]
    },
    { icon: 'account_circle', text: 'My Profile', link: 'my-profile.html' },
    { icon: 'logout', text: 'Logout', link: '#', action: 'logout' }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = restaurantMenu;
}
