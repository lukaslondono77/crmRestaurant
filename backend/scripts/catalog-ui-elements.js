#!/usr/bin/env node

/**
 * Static analysis: catalog buttons and forms from fila/*.html.
 * Output: catalog-ui-elements.json in backend/
 */

const fs = require('fs');
const path = require('path');

const filaDir = path.join(__dirname, '../../fila');
const outPath = path.join(__dirname, '../catalog-ui-elements.json');

const catalog = { buttons: [], forms: [], pages: [], generated: new Date().toISOString() };

function extractButtons(html, file) {
  const buttons = [];
  const regex = /<button[^>]*>|<\s*a\s+[^>]*class="[^"]*btn[^"]*"[^>]*>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const tag = m[0].toLowerCase();
    const isView = /visibility|view|ri-eye|view\s*</i.test(m[0]);
    const isEdit = /edit|ri-edit|pencil/i.test(m[0]);
    const isDelete = /delete|ri-delete|trash|remove/i.test(m[0]);
    const isSave = /save|submit|ri-save|guardar/i.test(m[0]);
    buttons.push({ file, type: isView ? 'view' : isEdit ? 'edit' : isDelete ? 'delete' : isSave ? 'save' : 'action', snippet: m[0].slice(0, 80) });
  }
  return buttons;
}

function extractForms(html, file) {
  const forms = [];
  const formRegex = /<form[^>]*id="([^"]*)"[^>]*>|<\s*form[^>]*>/gi;
  let m;
  while ((m = formRegex.exec(html)) !== null) {
    const id = (m[1] || '').trim() || '(no id)';
    forms.push({ file, formId: id, snippet: m[0].slice(0, 100) });
  }
  return forms;
}

try {
  const files = fs.readdirSync(filaDir).filter((f) => f.endsWith('.html'));
  for (const f of files) {
    const filePath = path.join(filaDir, f);
    const html = fs.readFileSync(filePath, 'utf8');
    const buttons = extractButtons(html, f);
    const forms = extractForms(html, f);
    catalog.pages.push(f);
    catalog.buttons.push(...buttons);
    catalog.forms.push(...forms);
  }
  catalog.summary = {
    pages: catalog.pages.length,
    buttons: catalog.buttons.length,
    forms: catalog.forms.length
  };
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('\n📋 UI catalog generated:', outPath);
  console.log('   Pages:', catalog.summary.pages, '| Buttons:', catalog.summary.buttons, '| Forms:', catalog.summary.forms, '\n');
} catch (e) {
  console.error('Catalog error:', e.message);
  process.exit(1);
}
