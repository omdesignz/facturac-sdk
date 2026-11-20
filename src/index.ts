import type {
    Agt,
    Billing,
    Customer,
    DocumentIssue,
    Read,
    Service,
} from './contracts.js';
export type {
    Agt,
    Billing,
    Customer,
    DocumentIssue,
    Read,
    Service,
} from './contracts.js';

export interface FacturacOptions {
    /** HTTPS origin of your Facturac deployment. No API path. */
    baseUrl: string;
    token: string;
    workspacePublicId: string;
    entityPublicId: string;
    environment: 'homologation' | 'production';
    timeoutMs?: number;
    fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
    signal?: AbortSignal;
    clientRequestId?: string;
}

export interface CommandOptions extends RequestOptions {
    /** Persist this key with the payload before sending. Reuse both on uncertain outcomes. */
    idempotencyKey: string;
}

export class FacturacError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        public readonly requestId: string | null,
        public readonly retryAfter: string | null,
    ) {
        super(`Facturac request failed (${status}, ${code}).`);
        this.name = 'FacturacError';
    }
}

const publicId = (value: string): string => {
    if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value)) {
        throw new TypeError('Expected a public ULID.');
    }

    return value.toLowerCase();
};

type Query = Record<string, string | number | undefined>;
type Page<T> = { data: T[]; meta: { page: number; last_page: number } };

/** A server-side client. Never put integration credentials in browser bundles or mobile apps. */
export class Facturac {
    #origin: string;
    #token: string;
    #scope: string;
    #fetch: typeof globalThis.fetch;
    #timeoutMs: number;

    constructor(options: FacturacOptions) {
        const url = new URL(options.baseUrl);

        if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            url.pathname !== '/'
        ) {
            throw new TypeError(
                'baseUrl must be an HTTPS origin without credentials, query, fragment, or API path.',
            );
        }

        if (
            !/^fcr1\.[0-7][0-9A-HJKMNP-TV-Z]{25}\.[A-Za-z0-9_-]{43}$/.test(
                options.token,
            )
        ) {
            throw new TypeError('Expected a Facturac integration credential.');
        }

        if (!['homologation', 'production'].includes(options.environment)) {
            throw new TypeError(
                'Expected production or homologation environment.',
            );
        }

        this.#timeoutMs = options.timeoutMs ?? 30_000;

        if (
            !Number.isSafeInteger(this.#timeoutMs) ||
            this.#timeoutMs < 1 ||
            this.#timeoutMs > 2_147_483_647
        ) {
            throw new TypeError(
                'timeoutMs must be a positive integer no greater than 2147483647.',
            );
        }

        this.#origin = url.origin;
        this.#token = options.token;
        this.#scope = `workspaces/${publicId(options.workspacePublicId)}/legal-entities/${publicId(options.entityPublicId)}/environments/${options.environment}`;
        this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    }

    readonly documents = {
        issue: (
            data: DocumentIssue.DocumentIssueRequest,
            options: CommandOptions,
        ) =>
            this.#request<DocumentIssue.DocumentIssueResult>(
                'commands/v1',
                'documents',
                {},
                options,
                data,
            ),
        list: (
            query: Read.externalListFiscalDocumentsQuery = {},
            options: RequestOptions = {},
        ) =>
            this.#request<Read.DocumentListResponse>(
                'v1',
                'documents',
                query,
                options,
            ),
        get: (id: string, options: RequestOptions = {}) =>
            this.#request<Read.DocumentResponse>(
                'v1',
                `documents/${publicId(id)}`,
                {},
                options,
            ),
        agtStatus: (id: string, options: RequestOptions = {}) =>
            this.#request<Agt.QualifiedAgtStatusResponse>(
                'v2',
                `documents/${publicId(id)}/agt-status`,
                {},
                options,
            ),
        iterate: (
            query: Read.externalListFiscalDocumentsQuery = {},
            options: RequestOptions = {},
        ) => this.#iterate<Read.Document>('v1', 'documents', query, options),
    };

    readonly customers = {
        list: (
            query: Read.externalListCustomerQuery = {},
            options: RequestOptions = {},
        ) =>
            this.#request<Read.CustomerListResponse>(
                'v1',
                'customers',
                query,
                options,
            ),
        get: (id: string, options: RequestOptions = {}) =>
            this.#request<Read.CustomerResponse>(
                'v1',
                `customers/${publicId(id)}`,
                {},
                options,
            ),
        iterate: (
            query: Read.externalListCustomerQuery = {},
            options: RequestOptions = {},
        ) =>
            this.#iterate<Read.CustomerRead>('v1', 'customers', query, options),
        create: (
            data: Customer.CustomerCreateRequest,
            options: CommandOptions,
        ) =>
            this.#request<Customer.CustomerCreateResult>(
                'commands/v1',
                'customers',
                {},
                options,
                data,
            ),
    };

    readonly catalogue = {
        list: (
            query: Read.externalListCatalogueQuery = {},
            options: RequestOptions = {},
        ) =>
            this.#request<Read.CatalogueListResponse>(
                'v1',
                'catalogue-items',
                query,
                options,
            ),
        get: (id: string, options: RequestOptions = {}) =>
            this.#request<Read.CatalogueResponse>(
                'v1',
                `catalogue-items/${publicId(id)}`,
                {},
                options,
            ),
        iterate: (
            query: Read.externalListCatalogueQuery = {},
            options: RequestOptions = {},
        ) =>
            this.#iterate<Read.CatalogueItemList>(
                'v1',
                'catalogue-items',
                query,
                options,
            ),
        createService: (
            data: Service.CatalogueServiceCreateRequest,
            options: CommandOptions,
        ) =>
            this.#request<Service.CatalogueServiceCreateResult>(
                'commands/v1',
                'catalogue-services',
                {},
                options,
                data,
            ),
    };

    readonly billing = {
        summary: (
            query: Billing.readRecordedBillingSummaryQuery,
            options: RequestOptions = {},
        ) =>
            this.#request<Billing.Success>(
                'v2',
                'analytics/billing-summary',
                query,
                options,
            ),
    };

    async *#iterate<T>(
        version: string,
        path: string,
        query: Query,
        options: RequestOptions,
    ): AsyncGenerator<T> {
        let page = query.page ?? 1;

        if (
            typeof page !== 'number' ||
            !Number.isInteger(page) ||
            page < 1 ||
            page > 10_000
        ) {
            throw new TypeError('page must be an integer from 1 to 10000.');
        }

        while (page <= 10_000) {
            const result: Page<T> = await this.#request(
                version,
                path,
                { ...query, page },
                options,
            );

            if (
                !Array.isArray(result.data) ||
                result.meta?.page !== page ||
                !Number.isInteger(result.meta.last_page) ||
                result.meta.last_page < page
            ) {
                throw new FacturacError(200, 'INVALID_PAGINATION', null, null);
            }

            yield* result.data;

            if (page >= result.meta.last_page) {
                return;
            }

            page++;
        }

        throw new FacturacError(200, 'PAGINATION_LIMIT', null, null);
    }

    async #request<T>(
        version: string,
        path: string,
        query: Query,
        options: RequestOptions,
        data?: unknown,
    ): Promise<T> {
        const url = new URL(
            `/api/integrations/${version}/${this.#scope}/${path}`,
            this.#origin,
        );

        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }

        const headers: Record<string, string> = {
            Accept: 'application/json',
            Authorization: `Bearer ${this.#token}`,
        };

        if (options.clientRequestId !== undefined) {
            if (!/^[A-Za-z0-9._-]{1,64}$/.test(options.clientRequestId)) {
                throw new TypeError('Invalid clientRequestId.');
            }

            headers['X-Client-Request-ID'] = options.clientRequestId;
        }

        if (data !== undefined) {
            const key = (options as CommandOptions).idempotencyKey;

            if (
                typeof key !== 'string' ||
                !/^[\x20-\x7e]{1,128}$/.test(key) ||
                !key.trim()
            ) {
                throw new TypeError(
                    'A printable ASCII idempotencyKey of 1–128 characters is required.',
                );
            }

            headers['Idempotency-Key'] = key;
            headers['Content-Type'] = 'application/json';
        }

        const controller = new AbortController();
        const cancel = () => controller.abort(options.signal?.reason);

        if (options.signal?.aborted) {
            cancel();
        } else {
            options.signal?.addEventListener('abort', cancel, { once: true });
        }

        const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

        try {
            const response = await this.#fetch(url, {
                method: data === undefined ? 'GET' : 'POST',
                headers,
                body: data === undefined ? undefined : JSON.stringify(data),
                signal: controller.signal,
                redirect: 'error',
                credentials: 'omit',
                cache: 'no-store',
            });
            let body;

            try {
                body = await response.json();
            } catch {
                throw new FacturacError(
                    response.status,
                    'INVALID_RESPONSE',
                    response.headers.get('X-Request-ID'),
                    response.headers.get('Retry-After'),
                );
            }

            if (!response.ok) {
                const code =
                    typeof body?.error?.code === 'string' &&
                    /^[A-Z0-9_]{1,80}$/.test(body.error.code)
                        ? body.error.code
                        : 'HTTP_ERROR';

                throw new FacturacError(
                    response.status,
                    code,
                    response.headers.get('X-Request-ID') ??
                        body?.meta?.request_id ??
                        null,
                    response.headers.get('Retry-After'),
                );
            }

            if (
                !body ||
                typeof body !== 'object' ||
                !('data' in body) ||
                !('meta' in body)
            ) {
                throw new FacturacError(
                    response.status,
                    'INVALID_RESPONSE',
                    response.headers.get('X-Request-ID'),
                    null,
                );
            }

            return body as T;
        } finally {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', cancel);
        }
    }
}
