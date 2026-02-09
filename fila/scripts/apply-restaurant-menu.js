#!/usr/bin/env node
/**
 * Safe cleanup: Replace full template sidebar (APPS, PAGES, MODULES, OTHERS)
 * with restaurant-only menu in core HTML files.
 * No files deleted; only sidebar HTML replaced.
 */

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '..', 'core');
const SNIPPET_PATH = path.join(CORE_DIR, 'restaurant-menu-snippet.html');

// Files that have the full template menu (APPS, PAGES, MODULES) - from grep
const FILES_WITH_FULL_MENU = [
  'manual-data-entry.html',
  'wallet-balance.html',
  'users.html',
  'users-list.html',
  'user-profile.html',
  'starter.html',
  'settings.html',
  'reports.html',
  'products-list.html',
  'products-grid.html',
  'product-details.html',
  'orders.html',
  'order-tracking.html',
  'order-details.html',
  'notifications.html',
  'my-profile.html',
  'invoices.html',
  'invoice-details.html',
  'inventory-count.html',
  'alerts.html',
  'account-settings.html',
  'add-user.html',
  'change-password.html',
  'connections.html',
  'create-user.html',
  'create-product.html',
  'create-order.html',
  'create-category.html',
  'edit-product.html',
  'edit-category.html',
  'categories.html',
  'cart.html',
  'checkout.html',
  'blank-page.html',
  'data-entry-backup.html',
  '404-error-page.html',
  'internal-error.html',
];

function findMatchingClosingUl(html, startIndex) {
  let depth = 1; // already inside the <ul class="menu-inner"> we want to close
  let i = startIndex;
  const len = html.length;
  while (i < len) {
    const openTag = html.indexOf('<ul', i);
    const closeTag = html.indexOf('</ul>', i);
    if (closeTag === -1) return -1;
    if (openTag !== -1 && openTag < closeTag) {
      depth++;
      i = openTag + 1;
    } else {
      depth--;
      if (depth === 0) return closeTag;
      i = closeTag + 1;
    }
  }
  return -1;
}

function applyRestaurantMenu(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const openTag = '<ul class="menu-inner">';
  const idx = html.indexOf(openTag);
  if (idx === -1) {
    return { applied: false, reason: 'no menu-inner' };
  }
  const innerStart = idx + openTag.length;
  const closeIdx = findMatchingClosingUl(html, innerStart);
  if (closeIdx === -1) {
    return { applied: false, reason: 'no matching </ul>' };
  }
  let snippet = fs.readFileSync(SNIPPET_PATH, 'utf8');
  snippet = snippet.replace(/^<!--[\s\S]*?-->\n?/, '').trim();
  const indent = '                    ';
  const indentSnippet = snippet.split('\n').map(line => indent + line.trim()).join('\n');
  const newMenu = openTag + '\n' + indentSnippet + '\n' + indent + '</ul>';
  const before = html.slice(0, idx);
  const after = html.slice(closeIdx + 5);
  fs.writeFileSync(filePath, before + newMenu + after, 'utf8');
  return { applied: true };
}

function main() {
  if (!fs.existsSync(SNIPPET_PATH)) {
    console.error('Missing restaurant-menu-snippet.html in core/');
    process.exit(1);
  }
  let applied = 0;
  let skipped = 0;
  for (const name of FILES_WITH_FULL_MENU) {
    const filePath = path.join(CORE_DIR, name);
    if (!fs.existsSync(filePath)) {
      console.log('Skip (not found):', name);
      skipped++;
      continue;
    }
    if (!fs.readFileSync(filePath, 'utf8').includes('menu-title-text">APPS</span>')) {
      console.log('Skip (no APPS menu):', name);
      skipped++;
      continue;
    }
    const result = applyRestaurantMenu(filePath);
    if (result.applied) {
      console.log('OK:', name);
      applied++;
    } else {
      console.log('Skip (' + result.reason + '):', name);
      skipped++;
    }
  }
  console.log('\nDone. Applied:', applied, 'Skipped:', skipped);
}

main();
