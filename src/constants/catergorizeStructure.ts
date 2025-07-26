import fastJson from 'fast-json-stringify';

// Updated receipt item schema with all pricing fields
const receiptItemSchema = {
    type: 'object',
    properties: {
        item: { type: 'string' },
        price: { type: 'number' },
        rate: { type: 'number' },
        quantity: { type: 'number' },
        total: { type: 'number' }
    },
    required: ['item', 'price', 'rate', 'quantity', 'total']
};

// Updated summary schema (already correct)
const summarySchema = {
    type: 'object' as const,
    properties: {
        total_categories: { type: 'number' },
        total_items: { type: 'number' },
        total_amount: { type: 'number' }
    },
    required: ['total_categories', 'total_items', 'total_amount']
};

// Main categorization response serializer
const categorizationResponseStringify = fastJson({
    type: 'object',
    properties: {
        categories: {
            type: 'object',
            additionalProperties: {
                type: 'array',
                items: receiptItemSchema
            }
        },
        summary: summarySchema
    },
    required: ['categories', 'summary']
});

// Complete API response serializer
const receiptExtractionResponseStringify = fastJson({
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        categorization: {
            type: 'object',
            properties: {
                categories: {
                    type: 'object',
                    additionalProperties: {
                        type: 'array',
                        items: receiptItemSchema
                    }
                },
                summary: summarySchema
            },
            required: ['categories', 'summary']
        },
        filename: { type: 'string' },
        documentId: { type: 'string' },
        processingStatus: { 
            type: 'string',
            enum: ['pending', 'processed', 'error']
        } as any  // ✅ Type assertion to bypass TS error
    },
    required: ['success', 'categorization', 'filename']
});


export { categorizationResponseStringify, receiptExtractionResponseStringify };
    