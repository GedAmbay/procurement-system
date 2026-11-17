import sqlite3

con = sqlite3.connect('prisma/dev.db')
cur = con.cursor()
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").fetchall()

print("--- SQLITE DEV.DB DATA ---")
for (t,) in tables:
    count = cur.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]
    if count > 0:
        print(f"{t}: {count}")
