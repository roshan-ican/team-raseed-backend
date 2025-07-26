

import { FastifyInstance } from 'fastify';
import { db } from '../lib/firebase-admin';

export default async function getReceiptRoute(app: FastifyInstance) {
  app.get('/receipts', async (request, reply) => {
    try {
      // Parse query parameters
      const {
        category,
        receiptId,
        search,
        sortBy = 'date',
        sortOrder = 'desc',
        startDate,
        endDate,
        limit,
        offset
      } = request.query as {
        category?: string;
        receiptId?: string | string[];
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        startDate?: string;
        endDate?: string;
        limit?: string;
        offset?: string;
      };

      let query: FirebaseFirestore.Query = db.collection('receipts');

      if (category) {
        query = query.where('category', '==', category);
      }

      if (receiptId) {
        const ids = Array.isArray(receiptId) ? receiptId : [receiptId];
        // Firestore 'in' operator supports max 10 elements
        if (ids.length > 10) {
          return reply.status(400).send({ error: "'receiptId' filter supports up to 10 ids." });
        }
        query = query.where('receiptId', 'in', ids);
      }

      // Date filtering (inclusive)
      if (startDate) {
        query = query.where('receiptDate', '>=', new Date(startDate));
      }
      if (endDate) {
        query = query.where('receiptDate', '<=', new Date(endDate));
      }

      const snapshot = await query.get();
      console.log("snapshot_docs", snapshot);
      let receipts = snapshot.docs.map(doc => ({ receiptId: doc.id, ...doc.data() }));

      console.log("receipts_mapped:", receipts);
      // Filter by search term if provided (on merchantName or category)
      if (search) {
        const term = search.toLowerCase();
        receipts = receipts.filter((r: any) =>
          (r.merchantName && typeof r.merchantName === 'string' && r.merchantName.toLowerCase().includes(term)) ||
          (r.category && typeof r.category === 'string' && r.category.toLowerCase().includes(term))
        );
      }

      // Sorting
      receipts.sort((a: any, b: any) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        // If sorting by date/receiptDate, compare as timestamps
        if (sortBy === 'date' || sortBy === 'receiptDate') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        if (sortOrder === 'asc') {
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return aVal.localeCompare(bVal);
          }
          return aVal > bVal ? 1 : -1;
        } else {
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return bVal.localeCompare(aVal);
          }
          return aVal < bVal ? 1 : -1;
        }
      });

      // Pagination
      const start = offset ? parseInt(offset) : 0;
      const end = limit ? start + parseInt(limit) : undefined;
      const paginatedReceipts = receipts.slice(start, end);

      reply.send(paginatedReceipts);
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch receipts' });
    }
  });


}