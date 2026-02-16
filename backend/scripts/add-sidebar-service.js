/**
 * Script to add sidebarService.js to all HTML pages
 */

const fs = require('fs');
const path = require('path');

const filaDir = path.join(__dirname, '../../fila');
const sidebarServiceScript = '<script src="assets/js/sidebar/sidebarService.js"></script>';

// Pages that should NOT have sidebar service (public pages)
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

// Check if file already has sidebar service
function hasSidebarService(content) {
    return content.includes('sidebarService.js');
}

// Add sidebar service to file
function addSidebarServiceToFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Skip public pages
    if (publicPages.includes(fileName)) {
        return false;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if already has sidebar service
    if (hasSidebarService(content)) {
        return false;
    }
    
    // Find where to insert (after authHelper.js or apiService.js)
    let insertPosition = -1;
    
    // Try to find authHelper.js
    const authHelperPattern = /<script[^>]*src=["'][^"']*authHelper\.js["'][^>]*><\/script>/i;
    const authHelperMatch = content.match(authHelperPattern);
    
    if (authHelperMatch) {
        insertPosition = content.indexOf(authHelperMatch[0]) + authHelperMatch[0].length;
    } else {
        // Try apiService.js
        const apiServicePattern = /<script[^>]*src=["'][^"']*apiService\.js["'][^>]*><\/script>/i;
        const apiServiceMatch = content.match(apiServicePattern);
        if (apiServiceMatch) {
            insertPosition = content.indexOf(apiServiceMatch[0]) + apiServiceMatch[0].length;
        } else {
            // Find custom.js
            const customJsPattern = /<script[^>]*src=["'][^"']*custom\.js["'][^>]*><\/script>/i;
            const customJsMatch = content.match(customJsPattern);
            if (customJsMatch) {
                insertPosition = content.indexOf(customJsMatch[0]);
            }
        }
    }
    
    if (insertPosition === -1) {
        return false;
    }
    
    // Insert sidebar service script
    const sidebarScript = `\n        ${sidebarServiceScript}`;
    content = content.slice(0, insertPosition) + sidebarScript + '\n        ' + content.slice(insertPosition);
    
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
}

// Main execution
function main() {
    console.log('🔧 Adding sidebarService.js to all HTML pages...\n');
    
    const htmlFiles = getAllHtmlFiles(filaDir);
    let updated = 0;
    let skipped = 0;
    
    htmlFiles.forEach(file => {
        const fileName = path.basename(file);
        
        if (publicPages.includes(fileName)) {
            skipped++;
            return;
        }
        
        if (hasSidebarService(fs.readFileSync(file, 'utf8'))) {
            skipped++;
            return;
        }
        
        if (addSidebarServiceToFile(file)) {
            updated++;
            console.log(`✅ Added to: ${fileName}`);
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

module.exports = { addSidebarServiceToFile, getAllHtmlFiles };
