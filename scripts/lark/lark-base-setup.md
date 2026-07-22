# JCI KL Connect → Lark Base

This repository includes a resumable provisioner that creates the core JCI KL Connect business schema in Lark Base. It creates empty tables and relationships; it does not migrate Firestore records yet.

## What will be created

- One Base named `JCI KL Connect Database`
- One harmless `00 Setup` table retained from Lark's default table
- 19 business tables covering members, board appointments, projects, tasks, events, registrations, budgets, finance, inventory, sponsorships, points, mentorship, and benefits
- 32 linked-record relationships
- Original Firebase IDs alongside Lark links, ready for a later data migration

Operational collections such as webhook logs, workflow executions, audit/error logs, notification receipts, counters, and caches are intentionally excluded.

## 1. Configure the Lark custom app

Use the existing app ID `cli_aaea739ab3219eef`. In the Lark Developer Console, enable these app permissions and publish/approve the app version:

- `base:app:create`
- `base:table:read`
- `base:table:create`
- `base:table:update`
- `base:field:read`
- `base:field:create`
- `docs:permission.member:create` only when using `LARK_OWNER_OPEN_ID`

Lark references:

- [Create a Base](https://open.larksuite.com/document/server-docs/docs/bitable-v1/app/create)
- [Create a table](https://open.larksuite.com/document/server-docs/docs/bitable-v1/app-table/create)
- [Create a field](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-field/create)

## 2. Preview locally

```powershell
npm run lark:base:plan
```

This is the default and makes no API calls.

## 3. Create the Base

Set the App Secret only in the local terminal. Do not paste it into chat, commit it, or put it in a tracked file.

```powershell
$env:LARK_APP_ID="cli_aaea739ab3219eef"
$env:LARK_APP_SECRET="YOUR_SECRET_FROM_LARK_CONSOLE"
$env:LARK_TIME_ZONE="Asia/Kuala_Lumpur"

# Recommended: choose one visibility method.
$env:LARK_FOLDER_TOKEN="YOUR_LARK_FOLDER_TOKEN"
# Or grant a user full access after creation:
# $env:LARK_OWNER_OPEN_ID="ou_xxxxxxxxx"

npm run lark:base:create
```

On macOS/Linux, use `export NAME=value` instead of PowerShell's `$env:NAME=value`.

The script never prints the App Secret or access token. It writes only the Base token, URL (when supplied by Lark), table IDs, and schema version to `.lark-jcikl-state.json`, which is gitignored.

## Resume after an error

Lark may reject a field when an app permission is not yet approved. Fix the permission, copy `baseToken` from `.lark-jcikl-state.json`, then resume without creating a second Base:

```powershell
$env:LARK_BASE_TOKEN="app_xxxxxxxxx"
npm run lark:base:create
```

Existing tables, fields, and relationships are detected by name and reused. The provisioner does not delete tables or records and does not roll back completed API writes.

## Optional settings

| Variable | Purpose | Default |
|---|---|---|
| `LARK_BASE_NAME` | Base name | `JCI KL Connect Database` |
| `LARK_FOLDER_TOKEN` | Destination Lark folder | none |
| `LARK_OWNER_OPEN_ID` | User receiving full access | none |
| `LARK_BASE_TOKEN` | Resume an existing Base | none |
| `LARK_TIME_ZONE` | Base timezone | `Asia/Kuala_Lumpur` |
| `LARK_BASE_STATE_FILE` | Provisioning state path | `.lark-jcikl-state.json` |

## Scope boundary

This step creates the database schema only. Importing current Firestore records is a separate operation because it requires Firebase credentials, field normalization, duplicate handling, and a migration report.

## Firestore migration audit

Before importing records, run the read-only inventory. It reads `GOOGLE_APPLICATION_CREDENTIALS`, then falls back to `serviceAccountKey.json` or `serviceAccount.json` in the project root.

```powershell
npm run lark:migrate:audit
```

The generated `lark-migration-inventory.json` contains collection counts, field names, and detected value types only. It does not contain document values or personal data and is gitignored. Use this report to validate the final field mappings before any Lark record writes.

After reviewing the inventory, preview the record import:

```powershell
npm run lark:migrate:plan
```

The plan reads Firebase and writes only `lark-migration-report.json`. To import records after reviewing that report:

```powershell
$env:LARK_APP_SECRET="YOUR_CURRENT_SECRET"
npm run lark:migrate:apply
```

The importer is resumable. It uses `Firebase ID` as the idempotency key, and additionally uses `Source` for the combined `transactions`/`projectTrx` table. Relationship backfill is performed as a separate pass after record counts are verified.
