const fs = require('fs');

async function main() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('prisma/dev.db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all();
    console.log("--- SQLITE DEV.DB DATA ---");
    for (const { name } of tables) {
      const [{ count }] = db.prepare(`SELECT count(*) as count FROM "${name}"`).all();
      if (count > 0) {
        console.log(`${name}: ${count}`);
      }
    }
  } catch (e) {
    console.log("node:sqlite error:", e.message);
  }
}
main();
