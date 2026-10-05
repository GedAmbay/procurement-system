const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'app', 'api');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('const auth = await requireRole')) {
    content = content.replace(/const auth = await requireRole/g, 'const roleCheck = await requireRole');
    content = content.replace(/if \(!auth\.authorized\) return auth\.response;/g, 'if (!roleCheck.authorized) return roleCheck.response;');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'auth') walkDir(fullPath);
    } else if (file === 'route.ts') {
      processFile(fullPath);
    }
  }
}

walkDir(apiDir);
console.log("Done fixing shadowed auth variables.");
