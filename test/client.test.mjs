import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inspect } from 'node:util';
import { Facturac, FacturacError } from '../dist/index.js';

const id = '01J00000000000000000000000';
const token = `fcr1.${id}.${'a'.repeat(43)}`;
const config = {
    baseUrl: 'https://facturac.example',
    token,
    workspacePublicId: id,
    entityPublicId: id,
    environment: 'production',
};
const envelope = {
    data: [],
    meta: { page: 1, last_page: 1, request_id: 'request-123' },
};
function fixture(result = envelope, status = 200, headers = {}) {
    const calls = [];

    return {
        calls,
        client: new Facturac({
            ...config,
            fetch: async (url, init) => {
                calls.push({ url, init });

                return Response.json(result, { status, headers });
            },
        }),
    };
}

test('every SDK operation targets an existing external OpenAPI route', async () => {
    const { client, calls } = fixture();
    await client.documents.list({ page: 2, per_page: 10 });
    await client.documents.get(id);
    await client.documents.agtStatus(id);
    await client.customers.list({ q: 'José & Filhos' });
    await client.customers.get(id);
    await client.catalogue.list({ type: 'service', status: 'all' });
    await client.catalogue.get(id);
    await client.billing.summary({ month: '2026-11' });
    await client.customers.create(
        { name: 'Acme', tax_identification_number: '123456789' },
        { idempotencyKey: 'customer-1' },
    );
    await client.catalogue.createService(
        {
            code: 'CONSULT',
            name: 'Consulting',
            unit_price_minor: '9223372036854775807',
            currency_code: 'AOA',
            tax_treatment: 'IVA_NOR_14',
        },
        { idempotencyKey: 'service-1' },
    );
    const files = [
        'read-v1',
        'billing-v2',
        'qualified-agt-v2',
        'customer-create-v1',
        'catalogue-service-create-v1',
    ];
    const paths = files.flatMap((name) =>
        Object.entries(
            JSON.parse(
                readFileSync(
                    new URL(
                        `../openapi/openapi-external-${name}.json`,
                        import.meta.url,
                    ),
                ),
            ).paths,
        ),
    );

    for (const { url, init } of calls) {
        assert.ok(
            paths.some(
                ([path, methods]) =>
                    methods[init.method.toLowerCase()] &&
                    new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(
                        url.pathname,
                    ),
            ),
            url.pathname,
        );
        assert.equal(init.headers.Authorization, `Bearer ${token}`);
        assert.equal(init.credentials, 'omit');
        assert.equal(init.redirect, 'error');
        assert.equal(init.cache, 'no-store');
        assert.ok(!url.href.includes(token));
    }

    assert.equal(calls[3].url.searchParams.get('q'), 'José & Filhos');
    assert.equal(
        JSON.parse(calls.at(-1).init.body).unit_price_minor,
        '9223372036854775807',
    );
});

test('credentials cannot leak through client serialization or inspection', () => {
    const { client } = fixture();
    assert.ok(!JSON.stringify(client).includes(token));
    assert.ok(!inspect(client, { showHidden: true }).includes(token));
});

test('rejects insecure origins, malformed identity and header injection before sending', async () => {
    for (const baseUrl of [
        'http://example.com',
        'https://user:password@example.com',
        'https://example.com/api',
        'https://example.com/?token=secret',
        'https://example.com/#fragment',
    ]) {
        assert.throws(() => new Facturac({ ...config, baseUrl }), TypeError);
    }

    for (const overrides of [
        { token: 'bad' },
        { entityPublicId: '../customers' },
        { environment: 'test' },
        { timeoutMs: 0 },
    ]) {
        assert.throws(
            () => new Facturac({ ...config, ...overrides }),
            TypeError,
        );
    }

    const { client, calls } = fixture();
    assert.throws(() => client.documents.get('../escape'), TypeError);
    await assert.rejects(
        client.documents.list(
            {},
            { clientRequestId: 'foo\r\nAuthorization: bad' },
        ),
        TypeError,
    );
    await assert.rejects(client.customers.create({}, {}), TypeError);
    await assert.rejects(
        client.customers.create({}, { idempotencyKey: ' ' }),
        TypeError,
    );
    assert.equal(calls.length, 0);
});

test('returns typed errors and retry metadata without silently retrying commands', async () => {
    for (const status of [401, 403, 404, 409, 422, 429, 503]) {
        const { client, calls } = fixture(
            {
                error: { code: 'COMMAND_IN_PROGRESS' },
                meta: { request_id: 'req-1' },
            },
            status,
            { 'Retry-After': '30' },
        );
        await assert.rejects(
            client.customers.create(
                { name: 'Acme', tax_identification_number: '123456789' },
                { idempotencyKey: 'stable-key' },
            ),
            (error) => {
                assert.ok(error instanceof FacturacError);
                assert.equal(error.status, status);
                assert.equal(error.requestId, 'req-1');
                assert.equal(error.retryAfter, '30');
                assert.ok(!String(error).includes(token));

                return true;
            },
        );
        assert.equal(calls.length, 1);
    }
});

test('explicit retries preserve the exact body and idempotency key', async () => {
    const { client, calls } = fixture();
    const input = { name: 'Acme', tax_identification_number: '000123456' };
    const options = {
        idempotencyKey: 'stable-key',
        clientRequestId: 'erp-001',
    };
    await client.customers.create(input, options);
    await client.customers.create(input, options);
    assert.equal(calls[0].init.body, calls[1].init.body);
    assert.deepEqual(calls[0].init.headers, calls[1].init.headers);
});

test('pagination advances once per page and preserves filters', async () => {
    const seen = [];
    const client = new Facturac({
        ...config,
        fetch: async (url) => {
            const page = Number(url.searchParams.get('page'));
            seen.push(url.searchParams.get('q'));

            return Response.json({
                data: [{ page }],
                meta: { page, last_page: 3 },
            });
        },
    });
    const rows = [];

    for await (const row of client.customers.iterate({ q: 'Acme', page: 2 })) {
        rows.push(row);
    }

    assert.deepEqual(rows, [{ page: 2 }, { page: 3 }]);
    assert.deepEqual(seen, ['Acme', 'Acme']);
});

test('invalid pagination fails rather than looping or silently truncating', async () => {
    const { client, calls } = fixture({
        data: [],
        meta: { page: 1, last_page: 'bad' },
    });
    await assert.rejects(async () => {
        for await (const row of client.documents.iterate()) {
            assert.fail(`Unexpected row: ${JSON.stringify(row)}`);
        }
    }, FacturacError);
    assert.equal(calls.length, 1);
});

test('handles malformed JSON, unexpected success envelopes and transport errors', async () => {
    const client = new Facturac({
        ...config,
        fetch: async () =>
            new Response('<html>proxy failure</html>', { status: 502 }),
    });
    await assert.rejects(
        client.documents.list(),
        (error) => error.code === 'INVALID_RESPONSE' && error.status === 502,
    );
    const malformed = fixture({ unrelated: true });
    await assert.rejects(
        malformed.client.documents.list(),
        (error) => error.code === 'INVALID_RESPONSE',
    );
    const offline = new Facturac({
        ...config,
        fetch: async () => {
            throw new TypeError('Network unavailable');
        },
    });
    await assert.rejects(offline.documents.list(), /Network unavailable/);
});

test('timeouts and caller cancellation abort the underlying request', async () => {
    const waitForAbort = async (_url, { signal }) =>
        new Promise((_resolve, reject) => {
            if (signal.aborted) {
                return reject(signal.reason);
            }

            signal.addEventListener('abort', () => reject(signal.reason), {
                once: true,
            });
        });
    const client = new Facturac({
        ...config,
        timeoutMs: 5,
        fetch: waitForAbort,
    });
    await assert.rejects(
        client.documents.list(),
        (error) => error.name === 'AbortError',
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        client.documents.list({}, { signal: controller.signal }),
        (error) => error.name === 'AbortError',
    );
});
