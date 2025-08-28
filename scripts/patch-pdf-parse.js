const fs = require('fs');
const path = require('path');

// Path to the pdf-parse index.js file
const pdfParseIndexPath = path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'index.js');

if (fs.existsSync(pdfParseIndexPath)) {
  let content = fs.readFileSync(pdfParseIndexPath, 'utf8');
  
  // Replace isDebugMode to always be false to prevent test code from running
  content = content.replace(/let\s+isDebugMode\s+=\s+!module\.parent;/g, 'let isDebugMode = false;');
  
  // Write the patched content back
  fs.writeFileSync(pdfParseIndexPath, content);
  console.log('Successfully patched pdf-parse module');
} else {
  console.log('pdf-parse module not found, skipping patch');
}