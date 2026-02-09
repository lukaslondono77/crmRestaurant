/**
 * Script to update user info placeholders in all HTML pages
 * Replaces hardcoded "Mateo Luca" and "Admin" with dynamic placeholders
 */

const fs = require('fs');
const path = require('path');

const filaDir = path.join(__dirname, '../../fila');

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

// Update user info in file
function updateUserInfoInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Replace hardcoded user names with dynamic placeholders
    const replacements = [
        {
            pattern: /<h3[^>]*class="[^"]*fw-medium[^"]*fs-17[^"]*mb-0[^"]*">Mateo Luca<\/h3>/gi,
            replacement: '<h3 class="fw-medium fs-17 mb-0 user-name">Loading...</h3>'
        },
        {
            pattern: /<h3[^>]*class="[^"]*fw-medium[^"]*fs-17[^"]*mb-0[^"]*">[^<]*Admin[^<]*<\/h3>/gi,
            replacement: '<h3 class="fw-medium fs-17 mb-0 user-name">Loading...</h3>'
        },
        {
            pattern: /<span[^>]*class="[^"]*fs-15[^"]*fw-medium[^"]*">Admin<\/span>/gi,
            replacement: '<span class="fs-15 fw-medium user-role">Loading...</span>'
        },
        {
            pattern: /<span[^>]*class="[^"]*fs-15[^"]*fw-medium[^"]*">[^<]*User[^<]*<\/span>/gi,
            replacement: '<span class="fs-15 fw-medium user-role">Loading...</span>'
        }
    ];
    
    replacements.forEach(({ pattern, replacement }) => {
        if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
            updated = true;
        }
    });
    
    if (updated) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

// Main execution
function main() {
    console.log('🔧 Updating user info in headers...\n');
    
    const htmlFiles = getAllHtmlFiles(filaDir);
    let updated = 0;
    let skipped = 0;
    
    htmlFiles.forEach(file => {
        if (updateUserInfoInFile(file)) {
            updated++;
            console.log(`✅ Updated: ${path.basename(file)}`);
        } else {
            skipped++;
        }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated} pages`);
    console.log(`   ⏭️  Skipped: ${skipped} pages`);
}

if (require.main === module) {
    main();
}

module.exports = { updateUserInfoInFile };
