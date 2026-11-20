import { randomUUID } from 'node:crypto';
import { Facturac } from '@vapsolucoes.ao/facturac';
import { issuanceExamples } from './issuance-fixtures.mjs';

const workspace = '01J00000000000000000000000';
const entity = '01J00000000000000000000001';
const token = `fcr1.${workspace}.${'a'.repeat(43)}`;
const origin = 'https://demo.facturac.invalid';
const scope = `workspaces/${workspace.toLowerCase()}/legal-entities/${entity.toLowerCase()}/environments/production`;

function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}

/** In-memory fixture simulation, not a fiscal engine or a hosted sandbox. No network fallback. */
export function createIssuanceDemoClient() {
    const operations = new Map();
    const issued = new Map();
    const fixtures = [
        {
            body: issuanceExamples.invoice,
            id: issuanceExamples.creditNote.references_document_public_id,
        },
        {
            body: issuanceExamples.invoiceReceipt,
            id: '01j00000000000000000000002',
        },
        { body: issuanceExamples.creditNote, id: '01j00000000000000000000003' },
    ];
    function failure(status, code) {
        return Response.json(
            {
                error: { code, message: 'Synthetic demo response.' },
                meta: { request_id: randomUUID() },
            },
            { status },
        );
    }
    return new Facturac({
        baseUrl: origin,
        token,
        workspacePublicId: workspace,
        entityPublicId: entity,
        // The real command contract is production-only. This transport is entirely local.
        environment: 'production',
        fetch: async (input, init) => {
            const url = new URL(input);
            init.signal?.throwIfAborted();
            if (
                url.origin !== origin ||
                url.search ||
                init.headers.Authorization !== `Bearer ${token}`
            ) {
                throw new Error('Unsupported issuance demo request.');
            }
            if (
                init.method === 'GET' &&
                url.pathname.startsWith(
                    `/api/integrations/v1/${scope}/documents/`,
                )
            ) {
                const record = issued.get(url.pathname.split('/').at(-1));
                return record
                    ? Response.json({
                          data: record,
                          meta: {
                              request_id: randomUUID(),
                              workspace_public_id: workspace,
                              legal_entity_public_id: entity,
                              environment: 'production',
                          },
                      })
                    : failure(404, 'NOT_FOUND');
            }
            if (
                init.method !== 'POST' ||
                url.pathname !==
                    `/api/integrations/commands/v1/${scope}/documents`
            ) {
                throw new Error(
                    'The issuance demo supports document issue and get only.',
                );
            }
            const key = init.headers['Idempotency-Key'];
            const body = JSON.parse(init.body);
            const fingerprint = canonical(body);
            const previous = operations.get(key);
            if (previous && previous.fingerprint !== fingerprint)
                return failure(409, 'IDEMPOTENCY_CONFLICT');
            if (previous)
                return Response.json(previous.result, {
                    status: 201,
                    headers: { 'Idempotency-Replayed': 'true' },
                });
            const fixture = fixtures.find(
                (item) => canonical(item.body) === fingerprint,
            );
            if (!fixture) return failure(422, 'VALIDATION_FAILED');
            if (
                body.document_type === 'NC' &&
                !issued.has(body.references_document_public_id)
            )
                return failure(409, 'DOCUMENT_BLOCKED');
            // Each fixture represents one business operation. A new key is not a retry.
            if (issued.has(fixture.id)) return failure(409, 'DOCUMENT_BLOCKED');
            const result = {
                data: { public_id: fixture.id },
                meta: { operation_id: randomUUID() },
            };
            issued.set(fixture.id, {
                public_id: fixture.id,
                document_no: `${body.document_type} DEMO/${issued.size + 1}`,
                document_type: body.document_type,
                environment: 'production',
                revision: 1,
                currency_code: 'AOA',
                gross_total_minor: Number(body.expected_total_minor),
                issue_status: 'issued',
                agt_status: 'accepted',
                agt_status_source: 'submission',
            });
            operations.set(key, { fingerprint, result });
            return Response.json(result, {
                status: 201,
                headers: { 'Idempotency-Replayed': 'false' },
            });
        },
    });
}
