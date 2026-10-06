const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
schema = schema.replace(/totalAmount            Float        @default\(0\)\n  remarks                String\?/, 'totalAmount            Float        @default(0)\n  status                 String       @default("APPROVED")\n  remarks                String?');
fs.writeFileSync(schemaPath, schema);
console.log('Restored status in schema');
