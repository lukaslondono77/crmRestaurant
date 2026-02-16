#!/usr/bin/env node
/**
 * Remove orphan APPS/PAGES/MODULES block left after apply-restaurant-menu.
 * Deletes from the first occurrence of "APPS</span>" (menu title) back to the
 * previous "</li>" and forward to the "</ul>" that immediately precedes "</aside>".
 */

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '..', 'core');

const FILES = [
  'reports.html', 'manual-data-entry.html', 'settings.html', 'alerts.html',
  'invoices.html', 'invoice-details.html', 'my-profile.html', 'notifications.html',
  'users.html', 'users-list.html', 'user-profile.html', 'starter.html',
  'products-list.html', 'products-grid.html', 'product-details.html',
  'orders.html', 'order-tracking.html', 'order-details.html',
  'wallet-balance.html', 'account-settings.html', 'add-user.html', 'change-password.html',
  'connections.html', 'create-user.html', 'create-product.html', 'create-order.html',
  'create-category.html', 'edit-product.html', 'edit-category.html', 'categories.html',
  'cart.html', 'checkout.html', 'blank-page.html', 'data-entry-backup.html',
  '404-error-page.html', 'internal-error.html'
];

function removeOrphanBlock(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const appSpan = '<span class="menu-title-text">APPS</span>';
  const idx = html.indexOf(appSpan);
  if (idx === -1) return { removed: false, reason: 'no APPS' };

  // Start: include the orphan </li> and newlines before APPS menu title
  const beforeApps = html.slice(0, idx);
  const appsLiStart = beforeApps.lastIndexOf('\n                    <li class="menu-title');
  if (appsLiStart === -1) return { removed: false, reason: 'no line start' };
  const beforeLi = html.slice(0, appsLiStart);
  const orphanLiEnd = beforeLi.lastIndexOf('</li>');
  if (orphanLiEnd === -1) return { removed: false, reason: 'no orphan </li>' };
  const start = orphanLiEnd; // remove from </li> through old menu's </ul>

  // End: find </aside> then the </ul> immediately before it
  const asideIdx = html.indexOf('</aside>', idx);
  if (asideIdx === -1) return { removed: false, reason: 'no aside' };
  const beforeAside = html.slice(0, asideIdx);
  const ulClose = beforeAside.lastIndexOf('</ul>');
  if (ulClose === -1) return { removed: false, reason: 'no ul close' };
  const end = ulClose + 5;

  if (start >= end) return { removed: false, reason: 'bad range' };

  const newHtml = html.slice(0, start) + html.slice(end);
  fs.writeFileSync(filePath, newHtml, 'utf8');
  return { removed: true };
}

function main() {
  let ok = 0, skip = 0;
  for (const name of FILES) {
    const filePath = path.join(CORE_DIR, name);
    if (!fs.existsSync(filePath)) { skip++; continue; }
    const result = removeOrphanBlock(filePath);
    if (result.removed) { console.log('OK:', name); ok++; }
    else { console.log('Skip (' + result.reason + '):', name); skip++; }
  }
  console.log('\nRemoved orphan block in', ok, 'files. Skipped:', skip);
}

main();
