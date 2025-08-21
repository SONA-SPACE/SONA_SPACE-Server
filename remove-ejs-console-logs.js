const fs = require('fs');
const path = require('path');

// Function to recursively get all EJS files in a directory
function getAllEJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllEJSFiles(filePath, fileList);
    } else if (file.endsWith('.ejs')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to remove console statements from an EJS file
function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove console.log, console.error, console.warn, console.info lines
    // More careful regex for EJS files that might have mixed HTML/JS
    content = content.replace(/^\s*console\.(log|error|warn|info|debug)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)\s*;?\s*$/gm, '');
    
    // Also handle console statements that might be within script tags
    content = content.replace(/(\s+)console\.(log|error|warn|info|debug)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)\s*;?(\s*)/g, '$1$3');
    
    // Remove empty lines that result from console log removal (but keep single empty lines)
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Write back if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Cleaned: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🧹 Starting EJS console.log cleanup...\n');

const viewsDir = path.join(__dirname, 'views');
const templateDir = path.join(__dirname, 'template');

let totalCleaned = 0;

// Clean views directory
if (fs.existsSync(viewsDir)) {
  console.log('📁 Cleaning views directory...');
  const ejsFiles = getAllEJSFiles(viewsDir);
  ejsFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

// Clean template directory
if (fs.existsSync(templateDir)) {
  console.log('\n📁 Cleaning template directory...');
  const templateFiles = getAllEJSFiles(templateDir);
  templateFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

console.log(`\n🎉 EJS cleanup complete! Cleaned ${totalCleaned} files.`);
console.log('⚠️  Note: Complex console statements may need manual review.');
