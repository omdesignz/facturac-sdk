#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FacturacError } from '@vapsolucoes.ao/facturac';
import { createIssuanceDemoClient } from './issuance-demo-client.mjs';
import { issuanceExamples } from './issuance-fixtures.mjs';

const usage = `Usage: facturac-issue-demo --demo

--demo  Issue synthetic FT, FR and NC fixtures, replay an operation, and detect a conflict.
--help  Show this help.

No account, live credentials, network requests or real fiscal documents.
The local simulation resets after each run. Live issuance uses documents.issue() in your server application.`;

export async function runIssuanceDemo() {
    const client = createIssuanceDemoClient();
    const results = [];
    for (const [name, payload] of Object.entries(issuanceExamples)) {
        const options = { idempotencyKey: `demo-${name}-001` };
        const result = await client.documents.issue(payload, options);
        const replay = await client.documents.issue(payload, options);
        if (JSON.stringify(result) !== JSON.stringify(replay))
            throw new Error('Replay changed the result.');
        const document = await client.documents.get(result.data.public_id);
        results.push({
            type: payload.document_type,
            publicId: result.data.public_id,
            number: document.data.document_no,
            replayVerified: true,
        });
    }
    try {
        await client.documents.issue(
            { ...issuanceExamples.invoice, notes: 'Different order' },
            { idempotencyKey: 'demo-invoice-001' },
        );
        throw new Error('Expected an idempotency conflict.');
    } catch (error) {
        if (
            !(error instanceof FacturacError) ||
            error.code !== 'IDEMPOTENCY_CONFLICT'
        )
            throw error;
    }
    return { documents: results, conflictVerified: true };
}

export async function main(args) {
    if (args.length === 1 && args[0] === '--help') return usage;
    if (args.length !== 1 || args[0] !== '--demo') throw new Error(usage);
    const result = await runIssuanceDemo();
    return `DEMO — synthetic data only. Issued ${result.documents.map((item) => item.type).join(', ')}. Replay and conflict checks passed. No real documents or AGT submissions.`;
}

if (
    process.argv[1] &&
    pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url
) {
    try {
        console.log(await main(process.argv.slice(2)));
    } catch (error) {
        console.error(
            error instanceof FacturacError
                ? {
                      status: error.status,
                      code: error.code,
                      requestId: error.requestId,
                  }
                : usage,
        );
        process.exitCode = 1;
    }
}
