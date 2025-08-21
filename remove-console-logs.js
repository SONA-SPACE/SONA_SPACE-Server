const fs = require('fs');

// Read the file
const filePath = 'c:\\Users\\Acer\\Desktop\\SONA SPACE\\SONA_SPACE-Server\\views\\dashboard\\contact\\contactformdetail.ejs';
let content = fs.readFileSync(filePath, 'utf8');

// Remove all console.log lines
content = content.replace(/^\s*console\.log\(.*?\);?\s*$/gm, '');

// Remove any double empty lines
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Removed all console.log statements from contactformdetail.ejs');
