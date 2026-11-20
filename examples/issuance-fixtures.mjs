/** Synthetic contract examples. Replace IDs and amounts with reviewed business data for live use. */
export const issuanceExamples = {
    invoice: {
        document_type: 'FT',
        customer_public_id: '01jd5q2m3n4p5r6s7t8v9w0x1y',
        lines: [
            {
                catalogue_item_public_id: '01jd5q8a9b0c1d2e3f4g5h6j7k',
                quantity: '2',
            },
        ],
        notes: 'Encomenda 1001',
        expected_total_minor: '22800',
    },
    invoiceReceipt: {
        document_type: 'FR',
        payment_method: 'CD',
        lines: [
            {
                description: 'Entrega ao domicílio',
                unit_price_minor: '150000',
                tax_treatment: 'IVA_NOR_14',
                service: true,
                quantity: '1',
            },
        ],
        expected_total_minor: '171000',
    },
    creditNote: {
        document_type: 'NC',
        references_document_public_id: '01jd5qa1b2c3d4e5f6g7h8j9k0',
        reason: 'Devolução de mercadoria',
        lines: [
            {
                line_number: 1,
                quantity: '1',
            },
        ],
        expected_total_minor: '11400',
    },
};
