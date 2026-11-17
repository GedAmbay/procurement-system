const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/dev.db');

const tables = [
  'offices', 'users', 'signatories', 'suppliers', 'items', 'fund_sources',
  'purchase_requests', 'pr_line_items', 'rfqs', 'rfq_line_items',
  'quotations', 'quotation_line_items', 'abstracts_of_quotation', 'abstract_line_items',
  'purchase_orders', 'po_line_items', 'acceptances', 'acceptance_line_items',
  'calendar_events', 'calendar_event_history', 'bac_attendance', 'bac_leave_records',
  'announcements', 'document_audit_log'
];

for (const t of tables) {
  try {
    const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
    console.log(`${t} (${cols.length} cols):`, cols.join(', '));
  } catch (e) {
    console.log(`${t}: not found or error`, e.message);
  }
}
