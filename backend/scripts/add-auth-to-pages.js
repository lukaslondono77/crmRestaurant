/**
 * Script to add authentication to all HTML pages
 * Adds authService.js and authHelper.js before custom.js or at the end of scripts
 */

const fs = require('fs');
const path = require('path');

const filaDir = path.join(__dirname, '../../fila');
const authServiceScript = '<script src="assets/js/auth/authService.js"></script>';
const authHelperScript = '<script src="assets/js/auth/authHelper.js"></script>';

// Pages that should NOT have auth (public pages)
const publicPages = [
    'sign-in.html',
    'sign-up.html',
    'forgot-password.html',
    'reset-password.html',
    'confirm-email.html',
    '404-error-page.html',
    'coming-soon.html',
    'privacy-policy.html',
    'terms-conditions.html'
];

// Get all HTML files
function getAllHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory() && file !== 'assets') {
            results = results.concat(getAllHtmlFiles(filePath));
        } else if (file.endsWith('.html')) {
            results.push(filePath);
        }
    });
    
    return results;
}

// Check if file already has auth scripts
function hasAuthScripts(content) {
    return content.includes('authService.js') || content.includes('authHelper.js');
}

// Add auth scripts to file
function addAuthToFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Skip public pages
    if (publicPages.includes(fileName)) {
        console.log(`⏭️  Skipping public page: ${fileName}`);
        return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has auth scripts
    if (hasAuthScripts(content)) {
        console.log(`✅ Already has auth: ${fileName}`);
        return false;
    }
    
    // Find where to insert (before custom.js or before closing body tag)
    let insertPosition = -1;
    
    // Try to find custom.js
    const customJsPattern = /<script[^>]*src=["'][^"']*custom\.js["'][^>]*><\/script>/i;
    const customJsMatch = content.match(customJsPattern);
    
    if (customJsMatch) {
        insertPosition = content.indexOf(customJsMatch[0]);
    } else {
        // If no custom.js, find closing body tag
        const bodyClosePattern = /<\/body>/i;
        const bodyCloseMatch = content.match(bodyClosePattern);
        if (bodyCloseMatch) {
            insertPosition = content.lastIndexOf('</body>');
        }
    }
    
    if (insertPosition === -1) {
        console.log(`⚠️  Could not find insertion point: ${fileName}`);
        return false;
    }
    
    // Insert auth scripts
    const authScripts = `\n        ${authServiceScript}\n        ${authHelperScript}`;
    content = content.slice(0, insertPosition) + authScripts + '\n        ' + content.slice(insertPosition);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Added auth to: ${fileName}`);
    return true;
}

// Main execution
function main() {
    console.log('🔐 Adding authentication to all HTML pages...\n');
    
    const htmlFiles = getAllHtmlFiles(filaDir);
    let updated = 0;
    let skipped = 0;
    
    htmlFiles.forEach(file => {
        const fileName = path.basename(file);
        
        if (publicPages.includes(fileName)) {
            skipped++;
            return;
        }
        
        if (hasAuthScripts(fs.readFileSync(file, 'utf8'))) {
            skipped++;
            return;
        }
        
        if (addAuthToFile(file)) {
            updated++;
        } else {
            skipped++;
        }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated} pages`);
    console.log(`   ⏭️  Skipped: ${skipped} pages`);
    console.log(`   📄 Total: ${htmlFiles.length} pages`);
}

if (require.main === module) {
    main();
}

module.exports = { addAuthToFile, getAllHtmlFiles };
