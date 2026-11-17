import { Facturac } from '@vapsolucoes.ao/facturac';

const workspace = '01J00000000000000000000000';
const entity = '01J00000000000000000000001';
const token = `fcr1.${workspace}.${'a'.repeat(43)}`;
const documents = [
    {
        public_id: '01J00000000000000000000003',
        document_no: 'FT DEMO/3',
        document_type: 'FT',
        environment: 'homologation',
        revision: 1,
        currency_code: 'AOA',
        gross_total_minor: 150000,
        issue_status: 'issued',
        agt_status: 'pending',
        agt_status_source: 'submission',
    },
    {
        public_id: '01J00000000000000000000002',
        document_no: null,
        document_type: 'FT',
        environment: 'homologation',
        revision: 1,
        currency_code: 'AOA',
        gross_total_minor: 50000,
        issue_status: 'draft',
        agt_status: 'draft',
        agt_status_source: 'draft',
    },
];

/** Local synthetic responses only; unsupported requests fail without network fallback. */
export function createDemoClient() {
    return new Facturac({
        baseUrl: 'https://demo.facturac.invalid',
        token,
        workspacePublicId: workspace,
        entityPublicId: entity,
        environment: 'homologation',
        fetch: async (input, init) => {
            const url = new URL(input);
            const path = `/api/integrations/v1/workspaces/${workspace.toLowerCase()}/legal-entities/${entity.toLowerCase()}/environments/homologation/documents`;
            if (
                url.origin !== 'https://demo.facturac.invalid' ||
                url.pathname !== path ||
                init.method !== 'GET' ||
                init.headers.Authorization !== `Bearer ${token}` ||
                [...url.searchParams.keys()].some(
                    (key) => !['page', 'per_page'].includes(key),
                )
            ) {
                throw new Error(
                    'The local demo supports document listing only.',
                );
            }
            init.signal?.throwIfAborted();
            const page = Number(url.searchParams.get('page') ?? 1);
            const perPage = Number(url.searchParams.get('per_page') ?? 1);
            if (
                !Number.isInteger(page) ||
                page < 1 ||
                page > 10000 ||
                !Number.isInteger(perPage) ||
                perPage < 1 ||
                perPage > 50
            ) {
                throw new Error('Invalid demo pagination.');
            }
            return Response.json({
                data: documents.slice((page - 1) * perPage, page * perPage),
                meta: {
                    request_id: '00000000-0000-4000-8000-000000000001',
                    workspace_public_id: workspace,
                    legal_entity_public_id: entity,
                    environment: 'homologation',
                    page,
                    per_page: perPage,
                    total: documents.length,
                    last_page: Math.ceil(documents.length / perPage),
                },
            });
        },
    });
}
