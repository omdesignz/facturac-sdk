import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Facturac, FacturacError } from '../dist/index.js';
import { createIssuanceDemoClient } from '../examples/issuance-demo-client.mjs';
import { issuanceExamples } from '../examples/issuance-fixtures.mjs';
import { main, runIssuanceDemo } from '../examples/issue-documents.mjs';

const id = '01J00000000000000000000000';
const config = {
    baseUrl: 'https://facturac.example',
    token: `fcr1.${id}.${'a'.repeat(43)}`,
    workspacePublicId: id,
    entityPublicId: id,
    environment: 'production',
};
const contract = JSON.parse(
    readFileSync(
        new URL(
            '../openapi/openapi-external-document-issue-v1.json',
            import.meta.url,
        ),
    ),
);
const [path, operation] = Object.entries(contract.paths)[0];

test('FT, FR and NC use the command contract with exact string amounts and caller idempotency keys', async () => {
    for (const [name, payload] of Object.entries(issuanceExamples)) {
        assert.deepEqual(
            payload,
            operation.post.requestBody.content['application/json'].examples[
                name
            ].value,
        );
        const response = {
            data: { public_id: id.toLowerCase() },
            meta: { operation_id: '00000000-0000-4000-8000-000000000001' },
        };
        const calls = [];
        const client = new Facturac({
            ...config,
            fetch: async (url, init) => {
                calls.push({ url, init });
                return Response.json(response, { status: 201 });
            },
        });
        const options = {
            idempotencyKey: `order-${name}`,
            clientRequestId: 'issue-example',
        };
        assert.deepEqual(
            await client.documents.issue(payload, options),
            response,
        );
        assert.deepEqual(
            await client.documents.issue(payload, options),
            response,
        );
        assert.equal(calls.length, 2);
        for (const { url, init } of calls) {
            assert.equal(
                url.pathname,
                path
                    .replaceAll('{workspacePublicId}', id.toLowerCase())
                    .replaceAll('{entityPublicId}', id.toLowerCase())
                    .replaceAll('{environment}', 'production'),
            );
            assert.equal(init.method, 'POST');
            assert.equal(
                init.headers['Idempotency-Key'],
                options.idempotencyKey,
            );
            assert.equal(
                init.headers['X-Client-Request-ID'],
                options.clientRequestId,
            );
            assert.equal(init.headers['Content-Type'], 'application/json');
            assert.equal(init.headers.Authorization, `Bearer ${config.token}`);
            assert.equal(init.redirect, 'error');
            assert.equal(init.credentials, 'omit');
            assert.equal(init.cache, 'no-store');
            assert.equal(init.body, JSON.stringify(payload));
        }
    }
});

test('issuance requires an idempotency key and does not automatically retry refusals or ambiguous transport failures', async () => {
    let calls = 0;
    const client = new Facturac({
        ...config,
        fetch: async () => {
            calls++;
            throw new Error('Lost response');
        },
    });
    for (const key of [
        undefined,
        '',
        ' ',
        'x'.repeat(129),
        'key\r\ninjected',
    ]) {
        await assert.rejects(
            client.documents.issue(issuanceExamples.invoice, {
                idempotencyKey: key,
            }),
            TypeError,
        );
    }
    assert.equal(calls, 0);
    await assert.rejects(
        client.documents.issue(issuanceExamples.invoice, {
            idempotencyKey: 'persisted-order',
        }),
        /Lost response/,
    );
    assert.equal(calls, 1);
    for (const [status, code] of [
        [409, 'DOCUMENT_BLOCKED'],
        [409, 'COMMAND_IN_PROGRESS'],
        [409, 'IDEMPOTENCY_CONFLICT'],
        [422, 'VALIDATION_FAILED'],
        [429, 'RATE_LIMITED'],
        [503, 'SERVICE_UNAVAILABLE'],
    ]) {
        let attempts = 0;
        const refused = new Facturac({
            ...config,
            fetch: async () => {
                attempts++;
                return Response.json(
                    { error: { code }, meta: { request_id: 'issue-request' } },
                    { status, headers: { 'Retry-After': '30' } },
                );
            },
        });
        await assert.rejects(
            refused.documents.issue(issuanceExamples.invoice, {
                idempotencyKey: 'persisted-order',
            }),
            (error) =>
                error instanceof FacturacError &&
                error.status === status &&
                error.code === code &&
                error.retryAfter === '30' &&
                error.requestId === 'issue-request',
        );
        assert.equal(attempts, 1);
    }
});

test('issuance demo runs offline with isolated state, readback and stable replay', async (t) => {
    const original = globalThis.fetch;
    globalThis.fetch = () => {
        throw new Error('Network forbidden');
    };
    t.after(() => {
        globalThis.fetch = original;
    });
    const result = await runIssuanceDemo();
    assert.deepEqual(
        result.documents.map((item) => item.type),
        ['FT', 'FR', 'NC'],
    );
    assert.equal(
        new Set(result.documents.map((item) => item.publicId)).size,
        3,
    );
    assert.ok(result.documents.every((item) => item.replayVerified));
    assert.equal(result.conflictVerified, true);
    assert.match(
        await main(['--demo']),
        /No real documents or AGT submissions/,
    );
    await assert.rejects(main(['--live']), /Usage/);
    await assert.rejects(main([]), /Usage/);
    await assert.rejects(
        createIssuanceDemoClient().documents.get(result.documents[0].publicId),
        { status: 404 },
    );
});

test('demo refusals consume no key, conflicts preserve the original document, unsupported routes never fall through', async () => {
    const client = createIssuanceDemoClient();
    const options = { idempotencyKey: 'order-1' };
    await assert.rejects(
        client.documents.issue(issuanceExamples.creditNote, {
            idempotencyKey: 'credit-1',
        }),
        { code: 'DOCUMENT_BLOCKED' },
    );
    await assert.rejects(
        client.documents.issue(
            { ...issuanceExamples.invoice, expected_total_minor: '1' },
            options,
        ),
        { status: 422 },
    );
    const first = await client.documents.issue(
        issuanceExamples.invoice,
        options,
    );
    await assert.rejects(
        client.documents.issue(issuanceExamples.invoiceReceipt, options),
        { code: 'IDEMPOTENCY_CONFLICT' },
    );
    const reversed = Object.fromEntries(
        Object.entries(issuanceExamples.invoice).reverse(),
    );
    assert.deepEqual(await client.documents.issue(reversed, options), first);
    assert.equal(
        (await client.documents.get(first.data.public_id)).data
            .gross_total_minor,
        22800,
    );
    await client.documents.issue(issuanceExamples.creditNote, {
        idempotencyKey: 'credit-1',
    });
    await assert.rejects(
        client.customers.list(),
        /supports document issue and get only/,
    );
    await assert.rejects(
        client.documents.issue(issuanceExamples.invoice, {
            idempotencyKey: 'cancelled',
            signal: AbortSignal.abort(),
        }),
        { name: 'AbortError' },
    );
});
