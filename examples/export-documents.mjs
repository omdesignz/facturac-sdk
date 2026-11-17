import { randomUUID } from 'node:crypto';
import { link, open, unlink } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Facturac, FacturacError } from '@vapsolucoes.ao/facturac';
import { createDemoClient } from './demo-client.mjs';

const fields = [
    'public_id',
    'document_no',
    'document_type',
    'environment',
    'revision',
    'currency_code',
    'gross_total_minor',
    'issue_status',
];

function cell(value) {
    const text = String(value ?? '');
    // Reject formula-like text instead of silently changing imported business data.
    if (/^[\s]*[=+@\-＝＋＠－]|^[\t\r\n]/u.test(text)) {
        throw new Error('A document field cannot be safely exported to CSV.');
    }
    return `"${text.replaceAll('"', '""')}"`;
}

/** Publish a complete register without overwriting an existing export. */
export async function exportDocuments(
    client,
    destination,
    { signal, perPage = 50 } = {},
) {
    const output = resolve(destination);
    const temporary = `${output}.${randomUUID()}.partial`;
    const file = await open(temporary, 'wx', 0o600);
    let count = 0;
    try {
        await file.writeFile(`${fields.join(',')}\r\n`);
        for await (const document of client.documents.iterate(
            { per_page: perPage },
            { signal },
        )) {
            if (
                !Number.isSafeInteger(document.gross_total_minor) ||
                !Number.isSafeInteger(document.revision) ||
                document.revision < 1
            ) {
                throw new Error(
                    'Document numbers exceed the safe integer range or are invalid.',
                );
            }
            const row = fields.map((field) => {
                if (field === 'gross_total_minor' || field === 'revision') {
                    return String(document[field]);
                }
                if (
                    typeof document[field] !== 'string' &&
                    !(field === 'document_no' && document[field] === null)
                ) {
                    throw new Error('A required document field is missing.');
                }
                return cell(document[field]);
            });
            await file.writeFile(`${row.join(',')}\r\n`);
            count++;
        }
        signal?.throwIfAborted();
        await file.sync();
        await file.close();
        // A hard link publishes the completed file and fails if the destination exists.
        await link(temporary, output);
        return count;
    } finally {
        await file.close();
        await unlink(temporary);
    }
}

export async function main(
    args = process.argv.slice(2),
    environment = process.env,
) {
    const demo = args[0] === '--demo';
    const live = args[0] === '--live';
    if ((!demo && !live) || args.length !== 2) {
        throw new Error(
            'Usage: node examples/export-documents.mjs --demo|--live /path/to/new-register.csv',
        );
    }
    let client;
    if (demo) {
        client = createDemoClient();
    } else {
        const required = [
            'FACTURAC_BASE_URL',
            'FACTURAC_TOKEN',
            'FACTURAC_WORKSPACE_ID',
            'FACTURAC_ENTITY_ID',
            'FACTURAC_ENVIRONMENT',
        ];
        if (required.some((name) => !environment[name])) {
            throw new Error(`Live mode requires: ${required.join(', ')}.`);
        }
        client = new Facturac({
            baseUrl: environment.FACTURAC_BASE_URL,
            token: environment.FACTURAC_TOKEN,
            workspacePublicId: environment.FACTURAC_WORKSPACE_ID,
            entityPublicId: environment.FACTURAC_ENTITY_ID,
            environment: environment.FACTURAC_ENVIRONMENT,
        });
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    try {
        const count = await exportDocuments(client, args[1], {
            signal: controller.signal,
            perPage: demo ? 1 : 50,
        });
        console.log(
            `${demo ? 'DEMO — synthetic data. ' : ''}Exported ${count} documents.`,
        );
    } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
    main().catch((error) => {
        if (error instanceof FacturacError) {
            console.error(
                JSON.stringify({
                    status: error.status,
                    code: error.code,
                    requestId: error.requestId,
                    retryAfter: error.retryAfter,
                }),
            );
        } else {
            console.error(
                'Export failed. Check arguments, required configuration, destination permissions, cancellation and document values. Existing exports were not overwritten.',
            );
        }
        process.exitCode = 1;
    });
}
