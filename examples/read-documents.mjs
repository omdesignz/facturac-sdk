import { Facturac, FacturacError } from '@vapsolucoes.ao/facturac';

const client = new Facturac({
    baseUrl: process.env.FACTURAC_BASE_URL,
    token: process.env.FACTURAC_TOKEN,
    workspacePublicId: process.env.FACTURAC_WORKSPACE_ID,
    entityPublicId: process.env.FACTURAC_ENTITY_ID,
    environment: process.env.FACTURAC_ENVIRONMENT ?? 'production',
});

try {
    const documents = await client.documents.list({ per_page: 10 });
    console.log(documents.data);
} catch (error) {
    if (error instanceof FacturacError) {
        console.error({
            status: error.status,
            code: error.code,
            requestId: error.requestId,
            retryAfter: error.retryAfter,
        });
    } else {
        console.error(
            'The request did not complete. Check connectivity and configuration.',
        );
    }

    process.exitCode = 1;
}
