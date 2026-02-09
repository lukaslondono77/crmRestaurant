#!/usr/bin/env node
/**
 * Remove redundant "Variance Detection" menu item (same as Waste Tracking / analytics.html).
 */

const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '..', 'core');

// Both indentation styles used in core HTML files
const BLOCK_PATTERN_1 = /                    <li class="menu-item">\n                        <a href="analytics\.html" class="menu-link">\n                            <span class="material-symbols-outlined menu-icon">warning<\/span>\n                            <span class="title">Variance Detection<\/span>\n                        <\/a>\n                    <\/li>\n\n                    /g;
const BLOCK_PATTERN_2 = /                    <li class="menu-item">\n                    <a href="analytics\.html" class="menu-link">\n                    <span class="material-symbols-outlined menu-icon">warning<\/span>\n                    <span class="title">Variance Detection<\/span>\n                    <\/a>\n                    <\/li>\n                    /g;

const files = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.html') && f !== 'restaurant-menu-snippet.html');
let total = 0;
for (const file of files) {
  const filePath = path.join(CORE_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('Variance Detection')) continue;
  const before = content;
  content = content.replace(BLOCK_PATTERN_1, '');
  content = content.replace(BLOCK_PATTERN_2, '');
  if (content !== before) {
    fs.writeFileSync(filePath, content);
    total++;
    console.log('Updated:', file);
  }
}
console.log('Done. Updated', total, 'files.');
