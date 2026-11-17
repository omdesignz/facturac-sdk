# Facturac SDK

Server-side JavaScript and TypeScript client for the Facturac integration API. Zero runtime dependencies, built-in TypeScript declarations, and Node.js 20 or later.

```sh
npm install @vapsolucoes.ao/facturac
```

The published package is [`@vapsolucoes.ao/facturac`](https://www.npmjs.com/package/@vapsolucoes.ao/facturac). This repository contains the SDK only. The Facturac application, credential management, and API implementation live in [omdesignz/facturac-ao](https://github.com/omdesignz/facturac-ao).

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
