const fs = require('fs');
const path = require('path');

// Function to recursively get all JS files in a directory
function getAllJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllJSFiles(filePath, fileList);
    } else if (file.endsWith('.js') && 
               !file.includes('remove-') && 
               !file.includes('node_modules') &&
               !file.includes('.min.')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to remove console statements from a file
function removeConsoleLogs(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove console.log, console.error, console.warn, console.info lines
    // This regex matches:
    // - Optional whitespace at start
    // - console.(log|error|warn|info|debug)
    // - Parentheses with any content (including nested parentheses)
    // - Optional semicolon
    // - End of line
    content = content.replace(/^\s*console\.(log|error|warn|info|debug)\s*\([^)]*(?:\([^)]*\)[^)]*)*\)\s*;?\s*$/gm, '');
    
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
console.log('🧹 Starting console.log cleanup...\n');

const routesDir = path.join(__dirname, 'routes');
const middlewareDir = path.join(__dirname, 'middleware');
const servicesDir = path.join(__dirname, 'services');
const publicJSDir = path.join(__dirname, 'public', 'javascripts');

let totalCleaned = 0;

// Clean routes directory
if (fs.existsSync(routesDir)) {
  console.log('📁 Cleaning routes directory...');
  const routeFiles = getAllJSFiles(routesDir);
  routeFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

// Clean middleware directory
if (fs.existsSync(middlewareDir)) {
  console.log('\n📁 Cleaning middleware directory...');
  const middlewareFiles = getAllJSFiles(middlewareDir);
  middlewareFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

// Clean services directory
if (fs.existsSync(servicesDir)) {
  console.log('\n📁 Cleaning services directory...');
  const serviceFiles = getAllJSFiles(servicesDir);
  serviceFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

// Clean public/javascripts directory
if (fs.existsSync(publicJSDir)) {
  console.log('\n📁 Cleaning public/javascripts directory...');
  const publicFiles = getAllJSFiles(publicJSDir);
  publicFiles.forEach(file => {
    if (removeConsoleLogs(file)) totalCleaned++;
  });
}

// Clean main app.js if it exists
const appJSPath = path.join(__dirname, 'app.js');
if (fs.existsSync(appJSPath)) {
  console.log('\n📁 Cleaning app.js...');
  if (removeConsoleLogs(appJSPath)) totalCleaned++;
}

console.log(`\n🎉 Cleanup complete! Cleaned ${totalCleaned} files.`);
console.log('⚠️  Note: Complex console statements may need manual review.');
