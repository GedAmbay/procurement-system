const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'app', 'api');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('requireRole')) {
    return; // Already processed
  }

  // Add import
  const importStatement = `import { requireRole } from "@/lib/auth-utils";\n`;
  
  // Find where to add import (after other imports)
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const endOfLastImport = content.indexOf('\n', lastImportIndex);
    content = content.slice(0, endOfLastImport + 1) + importStatement + content.slice(endOfLastImport + 1);
  } else {
    content = importStatement + content;
  }

  // Determine allowed roles for mutations based on path
  let mutationRoles = `["ADMIN", "BAC_SECRETARIAT"]`;
  if (filePath.includes('purchase-requests')) {
    mutationRoles = `["ADMIN", "BAC_SECRETARIAT", "END_USER"]`;
  }

  // Regex to match function declarations
  const functionRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;
  
  content = content.replace(functionRegex, (match, method) => {
    let roles = method === 'GET' ? `["ANY"]` : mutationRoles;
    // Exception: users can only be managed by ADMIN
    if (filePath.includes('users') && method !== 'GET') {
       roles = `["ADMIN"]`;
    }
    
    return `${match}\n  const auth = await requireRole(${roles});\n  if (!auth.authorized) return auth.response;\n`;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Processed: ${filePath}`);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'auth') { // skip auth
        walkDir(fullPath);
      }
    } else if (file === 'route.ts') {
      processFile(fullPath);
    }
  }
}

walkDir(apiDir);
console.log("Done adding auth checks to API routes.");
