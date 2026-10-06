const fs = require('fs');
const path = require('path');

const schemasPath = path.join(__dirname, 'lib', 'zod-schemas.ts');
let schemas = fs.readFileSync(schemasPath, 'utf8');
schemas = schemas.replace(/status:\s*z\.string\(\)\.optional\(\),/g, '');
schemas = schemas.replace(/export const purchaseRequestStatusUpdateSchema[\s\S]*?}\);/g, '');
fs.writeFileSync(schemasPath, schemas);
console.log('Fixed schemas');

const apiIdPath = path.join(__dirname, 'app', 'api', 'purchase-requests', '[id]', 'route.ts');
let apiId = fs.readFileSync(apiIdPath, 'utf8');
apiId = apiId.replace(/import { purchaseRequestSchema, purchaseRequestStatusUpdateSchema } from "@\/lib\/zod-schemas";/g, 'import { purchaseRequestSchema } from "@/lib/zod-schemas";');

// Remove the whole status update block
const statusBlockRegex = /\/\/ Check if it's just a status update[\s\S]*?return NextResponse\.json\(updatedPR\);\n    }\n\n/g;
apiId = apiId.replace(statusBlockRegex, '');

// Also remove the locking check which was relying on status
const lockingBlockRegex = /\/\/ Lock full updates if PR is already approved[\s\S]*?status: 403 }\);\n    }\n\n/g;
apiId = apiId.replace(lockingBlockRegex, '');
fs.writeFileSync(apiIdPath, apiId);
console.log('Fixed API [id]');

const apiPath = path.join(__dirname, 'app', 'api', 'purchase-requests', 'route.ts');
let api = fs.readFileSync(apiPath, 'utf8');
api = api.replace(/status:\s*"DRAFT",/g, '');
fs.writeFileSync(apiPath, api);
console.log('Fixed API POST');

const pagePath = path.join(__dirname, 'app', '(dashboard)', 'purchase-requests', 'page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');
page = page.replace(/status:\s*string;/g, '');
page = page.replace(/\{\s*key:\s*"status",[\s\S]*?width:\s*"140px",\s*\},\s*/g, '');
page = page.replace(/filterKey="status"[\s\S]*?\}\]/g, '');
fs.writeFileSync(pagePath, page);
console.log('Fixed page');

const pageIdPath = path.join(__dirname, 'app', '(dashboard)', 'purchase-requests', '[id]', 'page.tsx');
let pageId = fs.readFileSync(pageIdPath, 'utf8');
pageId = pageId.replace(/<div className="flex items-center gap-3">[\s\S]*?<\/div>/, '<div className="flex items-center gap-3">\n          <Link href="/purchase-requests" className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">\n            <ArrowLeft size={18} />\n          </Link>\n          <div>\n            <h1 className="text-lg font-bold text-slate-800">{isNew ? "New Purchase Request" : `PR: ${data.prNumber || ""}`}</h1>\n          </div>\n        </div>');
pageId = pageId.replace(/\{!isNew && \([\s\S]*?Status Update[\s\S]*?<\/div>\s*\)\s*\}/, '');
fs.writeFileSync(pageIdPath, pageId);
console.log('Fixed [id] page');
