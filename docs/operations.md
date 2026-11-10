# Operating the review desk

This is a trusted-operator tool. One isolated database per organisation. It has no public API, portal or user login. --actor records the name supplied; it does not establish identity. Keep database credentials outside Git. Do not expose the database owner connection to clients or a browser.

## Local and hosted data

Without DATABASE_URL, PGlite persists under .data/db or DATA_DIR. Run one local process at a time. PostgreSQL uses DATABASE_URL, TLS validation on remote hosts and parameterised values. Tables have row security enabled with no public policies; only the owning trusted connection operates them. No role-based shared app is provided. Granting public or broad database access defeats this boundary.

Use npm run migrate on an empty database, then add-location for real work. npm run demo is synthetic and refuses a PostgreSQL seed unless ALLOW_DEMO_SEED=yes explicitly selects a disposable database. Never use that option on a real database. DATA_DIR and OUTPUT_DIR isolate local data and generated files. .env and .env.local values load only when the variable is not already set.

## Backups and retention

Stop all local processes before copying the full PGlite data directory; test restoration into a separate directory. For PostgreSQL use your managed backup or pg_dump and test a restore into a new database. Keep encrypted backups with restricted access and an agreed expiry. JSON export includes all business records and original source evidence but is not a database restore format.

Original review text, reviewer names, replies and CSV can contain personal data. Exports, imports, drafts, views and docs-out stay private and out of Git. File permissions are restricted where supported by the operating system. Windows operators must set folder access using Windows permissions. Read-only HTML can be copied and is not a secure portal.

Before using a coding agent with real records, agree its data handling and access with the owner. The software makes no model calls. It does not send, monitor, schedule, scrape, delete or publish. Platform connections and public-facing surfaces need a separate tested scope.

## Audit limits

Imports, source versions, assessments, reply text, approvals and posting records reject edits and deletes through database triggers. Mutable assignments and decisions write events. A database owner can change the database or disable these controls; this is an operational history, not tamper-proof evidence.

The retention control only flags a due review. It is not an automated erasure system. Arrange a controlled purge or anonymisation process covering backups and all outputs when retention is no longer justified. Do not store unnecessary identifiers or account details in reply drafts.
