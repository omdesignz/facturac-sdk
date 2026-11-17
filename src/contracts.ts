// Generated from the external OpenAPI contracts by generate.mjs. Do not edit.
/* eslint-disable @typescript-eslint/no-namespace -- Type-only OpenAPI schema groups. */
export namespace Read {
    export type Document = {
        public_id: string;
        document_no: string | null;
        document_type:
            | 'FA'
            | 'FT'
            | 'FR'
            | 'FG'
            | 'GF'
            | 'AC'
            | 'AR'
            | 'TV'
            | 'RC'
            | 'RG'
            | 'RE'
            | 'ND'
            | 'NC'
            | 'AF'
            | 'RP'
            | 'RA'
            | 'CS'
            | 'LD';
        environment: 'homologation' | 'production';
        revision: number;
        currency_code: string;
        gross_total_minor: number;
        issue_status:
            | 'draft'
            | 'issued'
            | 'received'
            | 'processing'
            | 'valid'
            | 'invalid'
            | 'contingency';
        agt_status:
            | 'draft'
            | 'issued'
            | 'pending'
            | 'sending'
            | 'retrying'
            | 'received'
            | 'processing'
            | 'valid'
            | 'invalid'
            | 'rejected'
            | 'cancelled'
            | 'failed'
            | 'contingency';
        agt_status_source: 'draft' | 'submission' | 'legacy';
    };
    export type Meta = {
        request_id: string;
        workspace_public_id: string;
        legal_entity_public_id: string;
        environment: 'homologation' | 'production';
    };
    export type DocumentResponse = { data: Document; meta: Meta };
    export type DocumentListResponse = {
        data: Array<Document>;
        meta: Meta & {
            page: number;
            per_page: number;
            total: number;
            last_page: number;
        };
    };
    export type ReadError = {
        error: {
            code:
                | 'AUTHENTICATION_REQUIRED'
                | 'FORBIDDEN'
                | 'NOT_FOUND'
                | 'METHOD_NOT_ALLOWED'
                | 'VALIDATION_FAILED'
                | 'RATE_LIMITED'
                | 'INTERNAL_ERROR'
                | 'SERVICE_UNAVAILABLE';
            message: string;
        };
        meta: { request_id: string };
    };
    export type CustomerRead = {
        public_id: string;
        name: string;
        country_code: string;
        is_active: boolean;
    };
    export type CatalogueItemList = {
        public_id: string;
        code: string;
        type: 'product' | 'service';
        name: string;
        unit_of_measure: string;
        unit_price_minor: string;
        price_scale: 2;
        currency_code: string;
        tax_type: string;
        tax_code: string | null;
        tax_percentage: string;
        tax_exemption_code: string | null;
        is_active: boolean;
    };
    export type CatalogueItemDetail = {
        public_id: string;
        code: string;
        type: 'product' | 'service';
        name: string;
        unit_of_measure: string;
        unit_price_minor: string;
        price_scale: 2;
        currency_code: string;
        tax_type: string;
        tax_code: string | null;
        tax_percentage: string;
        tax_exemption_code: string | null;
        is_active: boolean;
        description: string | null;
    };
    export type MasterReadMeta = {
        request_id: string;
        workspace_public_id: string;
        legal_entity_public_id: string;
        environment: 'production';
        data_scope: 'legal_entity_master';
    };
    export type MasterListMeta = {
        request_id: string;
        workspace_public_id: string;
        legal_entity_public_id: string;
        environment: 'production';
        data_scope: 'legal_entity_master';
        page: number;
        per_page: number;
        total: number;
        last_page: number;
    };
    export type CustomerResponse = { data: CustomerRead; meta: MasterReadMeta };
    export type CustomerListResponse = {
        data: Array<CustomerRead>;
        meta: MasterListMeta;
    };
    export type CatalogueResponse = {
        data: CatalogueItemDetail;
        meta: MasterReadMeta;
    };
    export type CatalogueListResponse = {
        data: Array<CatalogueItemList>;
        meta: MasterListMeta;
    };
    export type externalListFiscalDocumentsQuery = {
        page?: number;
        per_page?: number;
        agt_status?:
            | 'draft'
            | 'issued'
            | 'pending'
            | 'sending'
            | 'retrying'
            | 'received'
            | 'processing'
            | 'valid'
            | 'invalid'
            | 'rejected'
            | 'cancelled'
            | 'failed'
            | 'contingency';
        type?:
            | 'FA'
            | 'FT'
            | 'FR'
            | 'FG'
            | 'GF'
            | 'AC'
            | 'AR'
            | 'TV'
            | 'RC'
            | 'RG'
            | 'RE'
            | 'ND'
            | 'NC'
            | 'AF'
            | 'RP'
            | 'RA'
            | 'CS'
            | 'LD';
    };
    export type externalListFiscalDocumentsResponse = DocumentListResponse;
    export type externalGetFiscalDocumentQuery = Record<string, never>;
    export type externalGetFiscalDocumentResponse = DocumentResponse;
    export type externalListCustomerQuery = {
        page?: number;
        per_page?: number;
        status?: 'active' | 'inactive' | 'all';
        q?: string;
    };
    export type externalListCustomerResponse = CustomerListResponse;
    export type externalReadCustomerQuery = Record<string, never>;
    export type externalReadCustomerResponse = CustomerResponse;
    export type externalListCatalogueQuery = {
        page?: number;
        per_page?: number;
        status?: 'active' | 'inactive' | 'all';
        q?: string;
        type?: 'product' | 'service';
        code?: string;
    };
    export type externalListCatalogueResponse = CatalogueListResponse;
    export type externalReadCatalogueQuery = Record<string, never>;
    export type externalReadCatalogueResponse = CatalogueResponse;
}
export namespace Billing {
    export type Count = number;
    export type NonnegativeMinor = string;
    export type SignedMinor = string;
    export type Month = string;
    export type PublicId = string;
    export type Bucket = {
        currency_code:
            'AOA' | 'BRL' | 'CNY' | 'EUR' | 'GBP' | 'NAD' | 'USD' | 'ZAR';
        minor_unit_scale: 2;
        billed_document_count: Count;
        credit_note_count: Count;
        invoiced_gross_minor: NonnegativeMinor;
        invoiced_net_minor: NonnegativeMinor;
        invoiced_tax_minor: NonnegativeMinor;
        credit_gross_minor: NonnegativeMinor;
        credit_net_minor: NonnegativeMinor;
        credit_tax_minor: NonnegativeMinor;
        after_credits_gross_minor: SignedMinor;
        after_credits_net_minor: SignedMinor;
        after_credits_tax_minor: SignedMinor;
    };
    export type Period = { month: Month; from: string; to_exclusive: string };
    export type Data = {
        metric_version: 'recorded-billing-v1';
        date_basis: 'document_date';
        timezone: 'Africa/Luanda';
        as_of: string;
        period: Period;
        currencies: [
            Bucket & { currency_code?: 'AOA' },
            Bucket & { currency_code?: 'BRL' },
            Bucket & { currency_code?: 'CNY' },
            Bucket & { currency_code?: 'EUR' },
            Bucket & { currency_code?: 'GBP' },
            Bucket & { currency_code?: 'NAD' },
            Bucket & { currency_code?: 'USD' },
            Bucket & { currency_code?: 'ZAR' },
        ];
    };
    export type Meta = {
        request_id: string;
        workspace_public_id: PublicId;
        legal_entity_public_id: PublicId;
        environment: 'production';
    };
    export type Success = { data: Data; meta: Meta };
    export type Error401 = {
        error: {
            code: 'AUTHENTICATION_REQUIRED';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error403 = {
        error: {
            code: 'FORBIDDEN';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error404 = {
        error: {
            code: 'NOT_FOUND';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error405 = {
        error: {
            code: 'METHOD_NOT_ALLOWED';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error422 = {
        error: {
            code: 'VALIDATION_FAILED';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error429 = {
        error: {
            code: 'RATE_LIMITED';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error500 = {
        error: {
            code: 'INTERNAL_ERROR';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type Error503 = {
        error: {
            code: 'SERVICE_UNAVAILABLE';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type readRecordedBillingSummaryQuery = { month: Month };
    export type readRecordedBillingSummaryResponse = Success;
}
export namespace Agt {
    export type PublicId = string;
    export type NullableObservationTime = string | null;
    export type Meta = {
        request_id: string;
        workspace_public_id: PublicId;
        legal_entity_public_id: PublicId;
        environment: 'homologation' | 'production';
    };
    export type QualifiedAgtStatus = unknown &
        unknown &
        unknown &
        unknown &
        unknown &
        unknown;
    export type QualifiedAgtStatusResponse = {
        data: QualifiedAgtStatus;
        meta: Meta;
    };
    export type ReadError = {
        error: {
            code:
                | 'AUTHENTICATION_REQUIRED'
                | 'FORBIDDEN'
                | 'NOT_FOUND'
                | 'METHOD_NOT_ALLOWED'
                | 'VALIDATION_FAILED'
                | 'RATE_LIMITED'
                | 'INTERNAL_ERROR'
                | 'SERVICE_UNAVAILABLE';
            message: 'Não foi possível concluir a consulta.';
        };
        meta: { request_id: string };
    };
    export type externalReadQualifiedAgtStatusV2Query = Record<string, never>;
    export type externalReadQualifiedAgtStatusV2Response =
        QualifiedAgtStatusResponse;
}
export namespace Customer {
    export type PublicId = string;
    export type CustomerCreateRequest = {
        name: string;
        tax_identification_number: string;
        country_code?: string;
    };
    export type CustomerCreateResult = {
        data: { public_id: PublicId };
        meta: { operation_id: string };
    };
    export type Error400 = {
        error: {
            code: 'INVALID_REQUEST';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error401 = {
        error: {
            code: 'UNAUTHENTICATED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error403 = {
        error: {
            code: 'FORBIDDEN';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error404 = {
        error: {
            code: 'NOT_FOUND';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error405 = {
        error: {
            code: 'METHOD_NOT_ALLOWED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error409 = {
        error: {
            code:
                | 'IDEMPOTENCY_CONFLICT'
                | 'COMMAND_IN_PROGRESS'
                | 'CUSTOMER_CONFLICT';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error413 = {
        error: {
            code: 'PAYLOAD_TOO_LARGE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error415 = {
        error: {
            code: 'UNSUPPORTED_MEDIA_TYPE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error422 = {
        error: {
            code: 'VALIDATION_FAILED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error429 = {
        error: {
            code: 'RATE_LIMITED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error503 = {
        error: {
            code: 'SERVICE_UNAVAILABLE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type externalCustomerCreateV1Query = Record<string, never>;
    export type externalCustomerCreateV1Response = CustomerCreateResult;
}
export namespace Service {
    export type PublicId = string;
    export type CatalogueServiceCreateRequest = {
        code: string;
        name: string;
        description?: string;
        unit_of_measure?: string;
        unit_price_minor: string;
        currency_code: 'AOA';
        tax_treatment: 'IVA_NOR_14' | 'IVA_ISE_M00' | 'NS_M02' | 'IVA_ISE_M04';
    };
    export type CatalogueServiceCreateResult = {
        data: { public_id: PublicId };
        meta: { operation_id: string };
    };
    export type Error400 = {
        error: {
            code: 'INVALID_REQUEST';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error401 = {
        error: {
            code: 'UNAUTHENTICATED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error403 = {
        error: {
            code: 'FORBIDDEN';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error404 = {
        error: {
            code: 'NOT_FOUND';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error405 = {
        error: {
            code: 'METHOD_NOT_ALLOWED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error409 = {
        error: {
            code:
                | 'IDEMPOTENCY_CONFLICT'
                | 'COMMAND_IN_PROGRESS'
                | 'CATALOGUE_CONFLICT';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error413 = {
        error: {
            code: 'PAYLOAD_TOO_LARGE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error415 = {
        error: {
            code: 'UNSUPPORTED_MEDIA_TYPE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error422 = {
        error: {
            code: 'VALIDATION_FAILED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error429 = {
        error: {
            code: 'RATE_LIMITED';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type Error503 = {
        error: {
            code: 'SERVICE_UNAVAILABLE';
            message: 'Não foi possível concluir o pedido.';
        };
        meta: { request_id: string };
    };
    export type externalCatalogueServiceCreateV1Query = Record<string, never>;
    export type externalCatalogueServiceCreateV1Response =
        CatalogueServiceCreateResult;
}
