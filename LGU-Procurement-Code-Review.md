# **LGU Procurement System** 

Code Review: Security, Authorization and Deployment Readiness 

Updated: October 5, 2026  |  Package: lgu-procurement.zip  |  Stack: Next.js 16, Auth.js, Prisma 

## **1. Scope and limitations** 

This was a first-pass review of the project structure, authentication setup, Prisma schema, configuration, seed script, and about half of the API routes. 

Not yet reviewed: the large page components (for example abstract/[id]/print/page.tsx), the login page, and the contents of prisma/dev.db (sqlite3 was not available in the review environment). It is a code review, not a penetration test, so an independent security test is still recommended before golive. 

## **2. Summary of findings** 

|**#**|**Severity**|**Finding**|**Where**|
|---|---|---|---|
|1|**Critical**|Acceptance (IAR) API has no authentication|api/acceptances|
|2|**Critical**|Roles are defined but mostly not enforced (authorization)|Most API routes|
|3|**Critical**|No ownership checks (IDOR)|PR, PO, RFQ routes|
|4|**Critical**|Unrestricted status transitions; approved records can be<br>rewritten|PR and PO routes|
|5|**Critical**|Audit trail almost empty|DocumentAuditLog,<br>audit-log page|
|6|**Critical**|Seed passwords and dev.db in the package|prisma/seed.ts, dev.db|
|7|**High**|Database is SQLite, not PostgreSQL|prisma/schema.prisma|
|8|**High**|Weak login hardening|auth.ts, zod-schemas.ts|
|9|**High**|IAR numbering is race-prone|api/acceptances|
|10|**High**|Acceptance logic gaps|api/acceptances/[id]|
|11|**High**|Inconsistent input validation|Several API routes|



Medium-severity items and housekeeping notes follow the detailed findings. Sections 8 to 10 cover whether to fix first or finish first, and how to add the inventory module. 

## **3. Critical findings (fix before any real deployment)** 

### **3.1 The acceptance (IAR) API has no authentication at all** 

app/api/acceptances/route.ts and app/api/acceptances/[id]/route.ts never call auth(). Anyone who can reach the server, logged in or not, can list all acceptances (with PO, supplier, and office data), create IARs, and change delivery quantities and status. The PUT handler can also flip a PO to COMPLETED. The routes also return error.message to the client. 

LGU Procurement System - Code Review  |  Page 1 

### **3.2 Authentication exists, but authorization mostly does not** 

Almost every route only checks whether a session exists. Role checks appear only in users, signatories (partly), and a little in purchase-requests. As a result, a VIEWER or END_USER can: 

- create or edit items, suppliers, fund sources, and offices; 

- change a PO's supplier, terms, and status; 

- set a PR to APPROVED or FOR_RFQ, which auto-creates the RFQ, AOQ, and PO. 

Roles such as APPROVING_OFFICIAL, BAC_SECRETARIAT, and BUDGET_OFFICER are defined but not enforced. Hiding buttons in the UI does not protect anything. 

### **3.3 No ownership checks (IDOR)** 

Any logged-in user can read or edit any PR, PO, or RFQ by ID, regardless of office. 

### **3.4 Status transitions are unrestricted** 

PATCH /purchase-orders/[id] accepts any status string from the request body. The PR status endpoint validates the enum but not the transition (for example, DRAFT straight to CLOSED, or back from APPROVED). A comment in the PR route says full updates are allowed indefinitely, and the update deletes and recreates all line items. An approved PR's items and amounts can therefore be silently rewritten, which is a COA concern. After approval or award, records should lock, and changes should go through logged amendments. 

### **3.5 The audit trail is nearly empty** 

DocumentAuditLog exists, but it is only written when a PR is printed. Creates, edits, approvals, status changes, deletions, and logins are not logged, and the Audit Log page is a placeholder. For a procurement system this is a major gap. 

### **3.6 Credentials and data in the package** 

- prisma/seed.ts hardcodes passwords (Admin@1234, Bac@1234, and so on). Make sure the seed never runs in production, or force a password change on first login. 

- prisma/dev.db is in the zip, and .gitignore does not exclude *.db, so it is probably committed too. It likely holds the seeded accounts and any test data. Add prisma/*.db to .gitignore, remove it from Git history, and do not deploy it. 

- Good news: no .env file was included in the zip. 

## **4. High-priority findings** 

### **4.1 The database is SQLite, not PostgreSQL** 

schema.prisma uses provider = "sqlite". For a multi-user production system, switch to PostgreSQL before go-live and test on it, because behavior differs: 

- contains search is case-sensitive on Postgres unless you add mode: "insensitive"; 

- roles and statuses are plain strings, so use Prisma enums to prevent invalid values; 

- you are using db push, so switch to prisma migrate so schema changes are versioned and repeatable; 

- check that money fields are Decimal, not Float (not verified in this review). 

### **4.2 Weak login hardening** 

- Minimum password length is 6. 

LGU Procurement System - Code Review  |  Page 2 

- No rate limiting or lockout on login, and no MFA. 

- isActive and role are baked into the JWT at login, so a deactivated user or role change does not take effect until the token expires (the Auth.js default is 30 days). Set a shorter maxAge, or re-check the user in the jwt callback. 

- Make sure AUTH_SECRET is set in production (it is not referenced in the code, so this could not be confirmed), and set AUTH_TRUST_HOST behind a reverse proxy. 

### **4.3 IAR numbering is race-prone** 

The IAR number comes from count + 1. Two people creating one at the same time can get duplicate numbers, and a delete can cause a number to be reused. Use a transaction with a unique constraint, or a counter table or sequence. 

### **4.4 Acceptance logic gaps** 

Delivered quantity is not capped at the ordered quantity, and Number(item.quantityDelivered) || 0 accepts negatives. The line-item updates and the main update are not in a single transaction, and acceptanceLineItem.update takes IDs from the request body without checking that they belong to this acceptance. 

### **4.5 Input validation is inconsistent** 

Zod is used for PRs and users, but items, signatories, POs, suppliers, and acceptances use raw req.json() values such as body.status and body.supplierId. Add schemas for all write endpoints. Several routes also lack try/catch, so errors surface as unhandled 500s. 

## **5. Medium-priority findings** 

- **Prisma logs every query** (log: ["query"]) in all environments. In production this fills logs and may expose sensitive values. Log only warnings and errors. 

- **No security headers** in next.config.ts. Add CSP, HSTS, X-Content-Type-Options, frameancestors, and Referrer-Policy. 

- **No middleware or proxy auth layer.** Add one as a first line of defense, but keep the perroute checks as well. 

- **Role checks use (session.user as any).role** everywhere. Add type augmentation for the session and a shared requireRole(...) helper so each route needs one line. 

- **Printing is browser-based.** The PR print route only increments a counter. There is no serverside PDF with a stored SHA-256 hash, no versioning, and no read-only finalized documents yet. 

- **Hard delete of draft PRs** is acceptable, but log it. After the draft stage, use soft delete or cancel-with-reason only. 

- **PrismaAdapter with strategy "jwt"** is redundant for credentials-only login. It is harmless, but it adds unused tables. 

## **6. Housekeeping** 

- fix-pos.js and seed_signatories.ts at the project root are one-off scripts. Move them to a scripts/ folder or delete them, and do not ship them. 

- The README is still the create-next-app default. Add setup, environment variable, backup, and deployment notes. 

LGU Procurement System - Code Review  |  Page 3 

- tsconfig.tsbuildinfo and next-env.d.ts were in the zip. They are ignored by Git, so leave them out of future zips. 

- No tests were present. At minimum, add tests for authorization rules (role by endpoint) and status transitions. 

- AGENTS.md and CLAUDE.md are tooling notes and can be kept or removed. 

## **7. Suggested order of work** 

1. Add auth() and role checks to the acceptance routes, then to every other write route. Use one shared helper and a role-permission table (role to allowed actions). 

2. Add office-scoped access for End Users, plus server-side status-transition rules and record locking after approval. 

3. Build real audit logging in a shared logAudit() helper called from every mutation, and make the Audit Log page work. 

4. Move to PostgreSQL with enums, Decimal money fields, and prisma migrate. 

5. Harden login: longer minimum password, rate limiting, shorter sessions with a user re-check, then MFA for admin and approving roles. 

6. Add security headers, quiet Prisma logging, and keep dev.db and seed passwords out of anything deployed. 

7. Build server-side PDF generation with a SHA-256 hash and versioning. 

8. Then do the deployment work: VM, managed PostgreSQL, backups, and monitoring. 

## **8. Should you fix first or finish the system first?** 

**Recommendation: fix the foundations first, then build the inventory module on top.** Do not finish everything and leave security for the end. 

### **8.1 Why not finish first and fix later** 

- **Every new module copies the current patterns.** Inventory will add many routes (stock in, stock out, adjustments, transfers, issuances). Built with the current logged-in-means-allowed pattern, they add dozens more routes to fix later. 

- **Retrofitting is harder than building it right.** Adding role checks, audit logging, and status locking to 40 finished routes means touching and retesting everything. A shared helper used from now on is far cheaper. 

- **Switching SQLite to PostgreSQL gets harder as the schema grows.** Do it before the inventory tables exist, so inventory is designed with enums, Decimal quantities, and migrations from the start. 

- **Inventory is high-risk data.** Stock movements are a classic place for fraud and shrinkage, so audit trails and separation of duties matter even more. 

### **8.2 Why not fix absolutely everything first** 

Not everything must be polished before moving on. Split the work into three groups. 

#### **Do now (foundation, roughly 1 to 2 weeks of focused work)** 

1. A shared requireRole() helper and a role-permission table, applied to all existing routes, starting with the unauthenticated acceptance API. 

2. A shared logAudit() helper and a working Audit Log page. 

LGU Procurement System - Code Review  |  Page 4 

3. Switch to PostgreSQL with prisma migrate, enums for roles and statuses, and Decimal for money and quantities. 

4. Server-side status-transition rules and record locking after approval. 

5. Remove dev.db and seed passwords from the repository, and quiet Prisma logging. 

#### **Do in parallel with new features (do not block on these)** 

- Login hardening: rate limiting, MFA, shorter sessions. 

- Security headers. 

- Zod schemas for the remaining routes. 

- Server-side PDF generation with hashing. 

- README, tests, and cleanup. 

#### **Do before go-live (not before building)** 

- Staging environment and security scan. 

- Backup and restore test. 

- Production deployment and Data Protection Officer sign-off. 

## **9. Adding an inventory management module** 

Procurement already ends at the IAR (acceptance), which is the natural link into inventory. Design the module with that connection in mind. 

### **9.1 Design guidance** 

- **Flow:** an accepted IAR creates stock-in entries, and a Requisition and Issue Slip (RIS) creates stock-out entries. There is already a ris page in the project, so check what exists first. 

- **Use a ledger, not a stored quantity.** Record every movement (in, out, adjustment, transfer) as its own row and compute current stock from the ledger. Never just edit a quantity-onhand number. This gives an audit trail and makes errors traceable. 

- **Immutable movements.** Corrections should be new adjustment entries with a reason, not edits or deletes. 

- **Separation of duties.** The person who receives stock should not be the one who approves adjustments. Consider roles such as Property/Supply Custodian and an Accounting/COA view. 

- **Reorder levels and low-stock alerts, plus unit costing.** LGUs commonly use weighted average or FIFO, so confirm the method with the accounting office. 

- **Physical count and adjustments** with approval and audit logging. 

- **Accountability fields** for property and equipment: accountable person, location, and transfer history. 

### **9.2 Reports to plan for** 

LGUs commonly need the following. Check the current COA forms and rules with your accounting and supply offices, since they may require specific formats. 

- Stock Card 

- Report on the Physical Count of Inventories (RPCI) 

- Report of Supplies and Materials Issued (RSMI) 

- Property Cards for semi-expendable and PPE items 

LGU Procurement System - Code Review  |  Page 5 

### **9.3 Decide the scope early** 

Decide whether the module covers only supplies and materials (consumables), or also semiexpendable property and equipment (PPE). The second is a much bigger module and it affects the database schema. 

## **10. Recommended overall sequence** 

1. Foundation fixes (Section 8.2, "Do now"). 

2. PostgreSQL migration, with the current schema stable. 

3. Inventory data model and ledger design, after agreeing on scope and COA forms. 

4. Build inventory using the shared helpers from day one. 

5. Connect IAR to stock-in and RIS to stock-out. 

6. Reports and PDFs for both modules. 

7. Staging, testing, then deployment. 

This keeps the delay small (the foundation is about one to two weeks) and avoids rebuilding a larger system later. 

## **11. What is already good** 

The overall structure is reasonable. Routes are organized sensibly, transactions are used in the PR flow, bcrypt with cost 12 is a good choice, and the workflow chain (PR, RFQ, AOQ, PO, IAR) is clear. The main work is closing the authorization and audit gaps. 

## **12. Suggested next deliverables** 

- A reusable requireRole helper and permission table, applied to the acceptance and PO routes. 

- A middleware layer and a logAudit function. 

- PostgreSQL schema changes: enums, Decimal fields, and indexes. 

- The inventory data model (Prisma schema for items, stock ledger, RIS, and adjustments) for design review before building. 

LGU Procurement System - Code Review  |  Page 6 

