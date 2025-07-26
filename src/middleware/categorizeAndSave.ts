import { randomUUID } from "crypto";
import { categorize } from "../services/categorize";
import { extractJsonFromResponse } from "../utils/extractJson";
import { db } from '../lib/firebase-admin';

import { Timestamp } from 'firebase-admin/firestore';
import { summarizeReceiptForEmbedding } from "../utils/summarizeReceipt";
import { createEmbedding } from "../utils/createEmbeddings";

// export const categorizeAndSaveToFireStore = async (rawText: string, data: any, isVideo: boolean, videoMeta: any) => {
//   const userId = generateUserId();

//   try {
//     // Step 1: Categorize
//     const categorizationRaw = await categorize(rawText || "");
//     let parsedCategorization = extractJsonFromResponse(categorizationRaw as string);
//     if (!parsedCategorization) {
//       parsedCategorization = {
//         categories: {},
//         summary: { total_categories: 0, total_items: 0 },
//       };
//     }

//     // Step 2: Generate receipt
//     const documentId = db.collection('receipts').doc().id;
//     const now = Timestamp.now(); // 🔄 Use Firestore Timestamps

//     const receipt = {
//       userId,
//       documentId,
//       filename: data.filename || 'unknown',
//       isVideo,
//       video: videoMeta || null,
//       processingStatus: 'processed' as const,
//       categorization: parsedCategorization,
//       rawText: typeof rawText === 'string' ? rawText : JSON.stringify(rawText || ''),
//       currency: 'INR',
//       vendor: null,
//       receiptDate: null,
//       total: calculateTotalFromCategorization(parsedCategorization),
//       subtotal: null,
//       tax: null,
//       createdAt: now,
//       updatedAt: now,
//     };

//     const cleanedReceipt = cleanUndefinedValues(receipt);

//     // Step 3: Summarize and create embedding
//     const summarizedText = summarizeReceiptForEmbedding(cleanedReceipt);
//     const embedding = await createEmbedding(summarizedText);

//     // Step 4: Save to Firestore
//     const saved = await saveToFireStore({ ...cleanedReceipt, embedding });
//     return { firstore: saved, parsedCategorization, receipt };

//   } catch (error) {
//     console.error('Error in categorizeAndSaveToFireStore:', error);
//     return { status: false, error };
//   }
// };


// Generate or get user ID (auto-generated approach)
function generateUserId(): string {
  // Option 1: Use UUID
  return `user_${randomUUID()}`;

  // Option 2: Use Firestore auto-generated ID format (uncomment to use)
  // return db.collection('users').doc().id;
}

// Helper function to calculate total from categorization
function calculateTotalFromCategorization(categorization: any): number {
  if (!categorization?.categories) return 0;

  let total = 0;
  Object.values(categorization.categories).forEach((items: any) => {
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        total += (item.price || 0) * (item.quantity || 1);
      });
    }
  });

  return total;
}

// Helper function to clean undefined values
export function cleanUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedValues(item));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanUndefinedValues(value);
    }
  }

  return cleaned;
}



export const saveToFireStore = async (cleanedReceipt: any) => {
  // --- Save to Firestore (Fixed) ---
  let documentId = '';
  try {
    const docRef = db.collection('receipts').doc();
    await docRef.set(cleanedReceipt);
    // request.log.info(`Receipt ${documentId} saved to Firestore with userId: ${userId}`);

    return { status: true };
  } catch (dbError) {
    // request.log.error({ err: dbError }, 'Firestore save failed');
    console.error("error while storing in firebase: ", dbError);
    return { status: false };
  }

};