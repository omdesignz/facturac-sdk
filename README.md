# Facturac SDK

Server-side JavaScript and TypeScript client for the Facturac integration API. Zero runtime dependencies, built-in TypeScript declarations, and Node.js 20 or later.

```sh
npm install @vapsolucoes.ao/facturac
```

The published package is [`@vapsolucoes.ao/facturac`](https://www.npmjs.com/package/@vapsolucoes.ao/facturac). This repository contains the SDK only. The Facturac application, credential management, and API implementation live in [omdesignz/facturac-ao](https://github.com/omdesignz/facturac-ao).

## Try an integration in five minutes

This repository includes a document-register CSV export and a local demo. No account, credentials, server, or network connection is needed after installing build dependencies:

```sh
git clone https://github.com/omdesignz/facturac-sdk.git
cd facturac-sdk
npm ci
npm run build
node examples/export-documents.mjs --demo /tmp/facturac-demo.csv
```

Expected output: `DEMO — synthetic data. Exported 2 documents.` On Windows, use a writable destination such as `facturac-demo.csv`. Choose a new filename on each run: existing exports are never overwritten. Open the CSV or import it into a staging table in your accounting/reporting system, treating public IDs and document numbers as text and amounts as integer minor units.

The demo exercises the real SDK, including two-page pagination, through an injected synthetic transport. It never falls back to network requests and ignores live credentials. It supports document listing only. It does not simulate authentication, rate limits, writes, AGT validation, or the full API. Its synthetic homologation records do not establish a hosted sandbox or production readiness.

### Connect the export to your deployment

1. Ask your deployment administrator to enable external reads after the deployment checks. The API implementation and integration management must be deployed; installing this SDK does not deploy them.
2. In **Definições → Integrações e API**, create an integration with only `documents:read`. Copy its workspace ID, legal-entity ID, environment, and one-time token into server-side secret configuration. The sponsoring owner/admin needs verified email, MFA, and a plan that includes integrations.
3. Supply all five environment variables below through your secret manager or an untracked environment file. Use the actual deployment's HTTPS origin, without `/api`. Never put a token in command-line arguments or committed files.
4. Run the same exporter with explicit `--live` mode and a new destination.

```text
FACTURAC_BASE_URL=https://your-deployment.example
FACTURAC_TOKEN=<one-time integration credential>
FACTURAC_WORKSPACE_ID=<public workspace ULID>
FACTURAC_ENTITY_ID=<public legal-entity ULID>
FACTURAC_ENVIRONMENT=production
```

```sh
# With variables already supplied to the process:
node examples/export-documents.mjs --live /secure/exports/documents-001.csv
# Node 20.6+ can also load an untracked file:
node --env-file=.env examples/export-documents.mjs --live /secure/exports/documents-002.csv
```

The destination directory must already exist and support hard links. The exporter writes a temporary file beside the destination, then exposes the completed export without replacing an existing file. Failures remove the temporary file; a forced process kill may leave a `.partial` file that must not be imported. File permissions are restricted to the owner on POSIX. Keep live exports in protected storage outside source control.

### What this export means

This is a document register for reconciliation and custom import adapters, not a complete ledger, SAF-T file, tax return, or certified fiscal export. The read API does not include dates, customer identities, tax breakdowns, or line items. No particular accounting vendor's import format is claimed.

Columns are `public_id`, `document_no`, `document_type`, `environment`, `revision`, `currency_code`, `gross_total_minor`, and `issue_status`. Null document numbers become empty CSV cells. Amounts remain integer minor units; unsafe JavaScript integers fail the export. Do not sum different currencies. Legacy AGT status is intentionally excluded; use the qualified status endpoint when your workflow needs that evidence.

Use workspace + legal entity + environment + public ID as the destination identity. Upsert by identity, retaining revision for reconciliation. The full register includes drafts and other statuses; apply your own posting rules rather than treating every row as revenue. Pagination is not a consistent snapshot and exposes no updated-since cursor. Reconcile repeated runs, handle changes during export, and never infer deletion from a missing row alone.

CSV fields are quoted and formula-like text is rejected, following the threat described by [OWASP](https://community.owasp.org/attacks/CSV_Injection). Import identifiers as text; spreadsheet edits and re-saving can change their representation. A failed export should not be imported.

### Sandbox and common failures

For testing against a real server, arrange a separate test deployment with synthetic data and credentials issued for its exact environment. `homologation` currently supports document reads and qualified AGT status, but does not provide production customers, catalogue, billing summaries, or write commands. Choosing that environment does not create test data or provision a sandbox.

| Result        | Next step                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| 401           | Check the credential, its expiry and revocation state.                                                              |
| 403           | Check scope, workspace/entity/environment binding, sponsoring user's access and integration entitlement.            |
| 404           | Check the deployed API routes and public record ID; an unavailable or foreign record can also return 404.           |
| 422           | Check query values against the bundled contract.                                                                    |
| 429           | Respect `Retry-After`; retry later with a new export filename.                                                      |
| 503           | Ask the operator to check feature flags, shared cache, audit storage, and deployment readiness.                     |
| Local failure | Check required variables, HTTPS origin, destination permissions, existing files and invalid/unsafe document values. |

The exporter logs status/code/request identifiers for API failures, never the credential or response body. It does not retry automatically. Use `Ctrl+C` to cancel; do not import `.partial` files.

## Quickstart

Create an integration in Facturac under **Definições → Integrações e API**. Copy its workspace ID, legal-entity ID, environment, and one-time credential into your server's secret configuration. The deployment must enable the relevant external API and your plan must include integrations.

```ts
import { Facturac, FacturacError } from '@vapsolucoes.ao/facturac';

const facturac = new Facturac({
    baseUrl: process.env.FACTURAC_BASE_URL!, // HTTPS origin, without /api.
    token: process.env.FACTURAC_TOKEN!,
    workspacePublicId: process.env.FACTURAC_WORKSPACE_ID!,
    entityPublicId: process.env.FACTURAC_ENTITY_ID!,
    environment: 'production',
});

const documents = await facturac.documents.list({ per_page: 25 });
console.log(documents.data);

for await (const customer of facturac.customers.iterate({ status: 'active' })) {
    // Synchronize customer.public_id with your application's records.
}
```

Keep credentials on the server. Never embed them in browser bundles, mobile apps, logs, or source control. A credential is bound to one workspace, legal entity, and environment. Browser sessions and mobile tokens cannot authenticate this client.

## Capabilities

| Methods                                                | Required scope              | Environment                |
| ------------------------------------------------------ | --------------------------- | -------------------------- |
| `documents.list`, `documents.get`, `documents.iterate` | `documents:read`            | Production or homologation |
| `documents.agtStatus`                                  | `documents:agt-status:read` | Production or homologation |
| `customers.list`, `customers.get`, `customers.iterate` | `customers:read`            | Production                 |
| `customers.create`                                     | `customers:create`          | Production                 |
| `catalogue.list`, `catalogue.get`, `catalogue.iterate` | `catalogue:read`            | Production                 |
| `catalogue.createService`                              | `catalogue:services:create` | Production                 |
| `billing.summary({ month: '2026-11' })`                | `analytics:billing:read`    | Production                 |

Responses retain the API's `data` and `meta` envelope. IDs are public ULIDs. Monetary values specified as strings remain strings; the client does not convert them to floating-point numbers. The legacy document status is not a substitute for qualified evidence returned by `documents.agtStatus`.

This release does not expose fiscal issuance/cancellation, payments, AGT submission, exports, or webhooks. Homologation is not a copy of production master data.

## Creating records safely

Persist the operation's idempotency key and payload before the first request. Reuse both unchanged if the outcome is uncertain.

```ts
const result = await facturac.customers.create(
    { name: 'Example Customer', tax_identification_number: '123456789' },
    { idempotencyKey: 'customer-import-row-123' },
);

const service = await facturac.catalogue.createService(
    {
        code: 'CONSULTING',
        name: 'Consulting service',
        unit_price_minor: '150000',
        currency_code: 'AOA',
        tax_treatment: 'IVA_NOR_14',
    },
    { idempotencyKey: 'catalogue-import-row-456' },
);
```

The SDK never retries requests automatically. A timeout or network error does not prove that a write failed. Consult the command contracts for conflict handling and retention limits; do not generate a new key just to retry the same operation.

## Errors, cancellation, and pagination

All methods accept an options object with `signal` and `clientRequestId`; write methods also require `idempotencyKey`. The default timeout is 30 seconds and can be changed with constructor option `timeoutMs`. A custom `fetch` implementation can be supplied for testing.

```ts
try {
    await facturac.documents.list(
        { per_page: 25 },
        {
            signal: AbortSignal.timeout(10_000),
            clientRequestId: 'erp-sync-001',
        },
    );
} catch (error) {
    if (error instanceof FacturacError) {
        console.error(
            error.status,
            error.code,
            error.requestId,
            error.retryAfter,
        );
    } else {
        // Network failure, cancellation, or invalid local configuration.
        throw error;
    }
}
```

`retryAfter` retains the server's `Retry-After` header. Async iterators preserve filters, follow numbered pages, and fail explicitly at the API's 10,000-page limit. Pagination is not a transactional snapshot. HTTPS is required; redirects are refused, cookies are omitted, and requests use `no-store`.

## Development

A fresh clone builds independently of the Laravel application:

```sh
git clone https://github.com/omdesignz/facturac-sdk.git
cd facturac-sdk
npm ci
npm test
npm run format:check
npm pack
```

`npm run build` generates types and compiles ESM plus declarations into `dist/`. `npm test` covers route alignment, transport behavior, idempotency, pagination, cancellation, secret handling, and installation of the packed artifact. CI runs these checks on Node.js 20, 22, and 24. Publishing is manual; CI has no npm credentials or publishing permissions.

The `openapi/` directory contains versioned snapshots of the five external contracts from Facturac. When updating the API, refresh these snapshots from its public `/developers/contracts/{contract}` endpoints or reviewed source files, run `npm run generate`, and review the generated diff in `src/contracts.ts`. Do not hand-edit generated types or redirect the SDK to browser/mobile APIs. The contract descriptions retain their original design history and do not establish production or regulatory approval.

Changes to repository metadata do not alter the already-published npm artifact. Package releases require a new version and verification of the exact archive before publication.
