import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDemoClient } from '../examples/demo-client.mjs';
import { exportDocuments, main } from '../examples/export-documents.mjs';

async function workspace(t) {
    const directory = await mkdtemp(join(tmpdir(), 'facturac-export-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    return { directory, destination: join(directory, 'register.csv') };
}

function records(iterate) {
    return { documents: { iterate } };
}

async function document() {
    return (await createDemoClient().documents.list()).data[0];
}

test('demo paginates through the real SDK without using the network', async (t) => {
    const { destination, directory } = await workspace(t);
    const original = globalThis.fetch;
    globalThis.fetch = () => {
        throw new Error('Network access forbidden');
    };
    t.after(() => {
        globalThis.fetch = original;
    });
    assert.equal(
        await exportDocuments(createDemoClient(), destination, { perPage: 1 }),
        2,
    );
    const content = await readFile(destination, 'utf8');
    assert.equal(content.split('\r\n').length, 4);
    assert.ok(content.includes('"FT DEMO/3"'));
    assert.ok(content.includes(',150000,'));
    assert.ok(content.includes('"homologation"'));
    assert.ok(!content.includes('agt_status'));
    assert.deepEqual(await readdir(directory), ['register.csv']);
    await assert.rejects(
        createDemoClient().customers.list(),
        /document listing only/,
    );
});

test('an existing destination remains intact', async (t) => {
    const { destination, directory } = await workspace(t);
    await writeFile(destination, 'previous export');
    await assert.rejects(exportDocuments(createDemoClient(), destination), {
        code: 'EEXIST',
    });
    assert.equal(await readFile(destination, 'utf8'), 'previous export');
    assert.deepEqual(await readdir(directory), ['register.csv']);
});

test('a later page failure never leaves a partial export at the destination', async (t) => {
    const { destination, directory } = await workspace(t);
    const item = await document();
    const client = records(async function* () {
        yield item;
        throw new Error('second page unavailable');
    });
    await assert.rejects(
        exportDocuments(client, destination),
        /second page unavailable/,
    );
    assert.deepEqual(await readdir(directory), []);
});

test('CSV quotes delimiters and rejects formula-like fields and unsafe money', async (t) => {
    const { destination } = await workspace(t);
    const item = await document();
    const client = records(async function* () {
        yield { ...item, document_no: 'FT "Demo", 3' };
    });
    await exportDocuments(client, destination);
    assert.ok(
        (await readFile(destination, 'utf8')).includes('"FT ""Demo"", 3"'),
    );
    for (const value of ['=1+1', ' +SUM(1)', '\tcommand', '＠SUM(1)']) {
        await assert.rejects(
            exportDocuments(
                records(async function* () {
                    yield { ...item, document_no: value };
                }),
                `${destination}.bad`,
            ),
            /safely exported/,
        );
    }
    await assert.rejects(
        exportDocuments(
            records(async function* () {
                yield {
                    ...item,
                    gross_total_minor: Number.MAX_SAFE_INTEGER + 1,
                };
            }),
            `${destination}.unsafe`,
        ),
        /safe integer/,
    );
});

test('cancellation and missing live settings fail without publishing a file', async (t) => {
    const { directory, destination } = await workspace(t);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        exportDocuments(createDemoClient(), destination, {
            signal: controller.signal,
        }),
        { name: 'AbortError' },
    );
    await assert.rejects(
        main(['--live', destination], {}),
        /Live mode requires/,
    );
    await assert.rejects(main([destination], {}), /Usage/);
    assert.deepEqual(await readdir(directory), []);
});
