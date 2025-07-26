// import { FastifyReply, FastifyRequest } from "fastify";
// // Required imports
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// // REMOVE client-side Firestore imports from here:
// // import { getFirestore, collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';

// // Keep only firebase-admin imports
// import { db } from '../lib/firebase-admin';
// import { firestore } from "firebase-admin"; // For Firestore types
// import { ReceiptDocument, ReceiptItem } from "../models/Receipt";
// import { getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
// import { createEmbedding } from "../utils/createEmbeddings";



// console.log('key', process.env.GEMINI_API_KEY);

// // Initialize Gemini
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// /**
//  * Cleans the AI's response by removing markdown code block fences.
//  * @param response The raw string response from the AI.
//  * @returns A cleaned string, hopefully pure JSON.
//  */
// const cleanAiJsonResponse = (response: string): string => {
//   // This regex specifically targets markdown code block fences (``` or ```json)
//   // and removes them from the beginning and end of the string.
//   return response.replace(/^```json\n?|\n?```$/g, '').trim();
// };
// export async function generateFirestoreQuery(prompt: string, userId: string) {
//   const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

//   const schemaContext = `
// You are a Firestore query and result-shaping expert.

// The Firestore collection is 'receipts'. Here's the TypeScript schema:

// ... // schema truncated for brevity

// Always include this constraint:
// { "type": "where", "field": "userId", "operator": "==", "value": "${userId}" }

// Return only a JSON object like this:

// {
//   "queryConstraints": [...],
//   "resultShape": {
//     "flattenCategorizedItems": true,
//     "includeFields": ["createdAt", "filename"],
//     "itemFilters": {
//       "categoryName": "Food",
//       "minPrice": 100
//     }
//   }
// }
//   `;

//   try {
//     const result = await model.generateContent([schemaContext, prompt]);

//     const rawJson = await result.response.text(); // <- get raw text
//     const jsonText = cleanAiJsonResponse(rawJson); // <- clean markdown artifacts

//     const { queryConstraints, resultShape } = JSON.parse(jsonText); // <- now safe

//     if (prompt.toLowerCase().includes('most expensive')) {
//       queryConstraints.push({ type: 'orderBy', field: 'total', direction: 'desc' });
//       queryConstraints.push({ type: 'limit', value: 1 });
//     }
//     const { results } = await runFirestoreQuery(queryConstraints, resultShape);

//     // 👇 Generate a smart summary from Gemini
//     const summary = await summarizeResults(prompt, results);

//     console.log('LLM Summary:', summary);

//     return {
//       success: true,
//       summary: summary.trim(),
//       rawResults: results, // Optional: only include if needed
//     };

//     return { success: true, queryConstraints, resultShape, results };
//   } catch (err: any) {
//     console.error('AI Error:', err);
//     return { success: false, queryConstraints: [], resultShape: {}, error: err.message };
//   }
// }




// export type FirestoreConstraint = {
//   type: 'where' | 'orderBy' | 'limit';
//   field?: string;
//   operator?: FirebaseFirestore.WhereFilterOp;
//   value?: any;
//   direction?: 'asc' | 'desc';
// };


// export async function runFirestoreQuery(
//   queryConstraints: FirestoreConstraint[],
//   resultShape: any = {}
// ) {
//   // ------ 1. Build the Firestore query (may need an index) ------
//   let q: FirebaseFirestore.Query = db.collection('receipts');
//   const orderBys: { field: string; direction: 'asc' | 'desc' }[] = [];
//   let hardLimit: number | undefined;

//   for (const c of queryConstraints) {
//     switch (c.type) {
//       case 'where':
//         q = q.where(c.field!, c.operator!, c.value);
//         break;
//       case 'orderBy':
//         q = q.orderBy(c.field!, c.direction || 'asc');
//         orderBys.push({ field: c.field!, direction: c.direction || 'asc' });
//         break;
//       case 'limit':
//         q = q.limit(c.value);
//         hardLimit = c.value;
//         break;
//       default:
//         throw new Error(`Unsupported query constraint type: ${c.type}`);
//     }
//   }

//   let docs: FirebaseFirestore.QueryDocumentSnapshot<ReceiptDocument>[] = [];

//   try {
//     // ------ 2. Run primary query ------
//     docs = (await q.get()).docs as FirebaseFirestore.QueryDocumentSnapshot<ReceiptDocument>[];
//   } catch (err: any) {
//     /* ---------- 3. Index‑free fallback ---------- */
//     const needIndex =
//       err?.code === 9 && typeof err?.details === 'string' && err.details.includes('The query requires an index');
//     if (!needIndex) throw err; // re‑throw unrelated errors

//     console.warn('[runFirestoreQuery] Falling back to client‑side sort (no index)…');

//     // a) re‑run WITHOUT orderBy / limit
//     let fallbackQ: FirebaseFirestore.Query = db.collection('receipts');
//     queryConstraints
//       .filter((c) => c.type === 'where')
//       .forEach((c) => {
//         fallbackQ = fallbackQ.where(c.field!, c.operator!, c.value);
//       });

//     docs = (await fallbackQ.get()).docs as FirebaseFirestore.QueryDocumentSnapshot<ReceiptDocument>[];

//     // b) sort in memory
//     if (orderBys.length) {
//       docs.sort((a, b) => {
//         for (const ob of orderBys) {
//           const av = (a.data() as any)[ob.field];
//           const bv = (b.data() as any)[ob.field];
//           if (av < bv) return ob.direction === 'asc' ? -1 : 1;
//           if (av > bv) return ob.direction === 'asc' ? 1 : -1;
//         }
//         return 0;
//       });
//     }

//     // c) apply limit
//     if (hardLimit !== undefined) docs = docs.slice(0, hardLimit);
//   }

//   /* ---------- 4. Optional embedding similarity re‑ranking ---------- */
//   if (resultShape.embeddingSearch && resultShape.textQuery) {
//     const queryEmbedding = await createEmbedding(resultShape.textQuery);
//     docs = docs
//       .filter((d:any) => Array.isArray(d.data().embedding))
//       .map((d:any) => ({
//         doc: d,
//         sim: cosineSimilarity(queryEmbedding, d.data().embedding!),
//       }))
//       .sort((a, b) => b.sim - a.sim)
//       .slice(0, resultShape.limit || 10)
//       .map((d) => d.doc);
//   }

//   /* ---------- 5. Transform & return ---------- */
//   const transformed = transformResults(docs, resultShape);
//   return { success: true, results: transformed };
// }

// export function transformResults(
//   docs: FirebaseFirestore.QueryDocumentSnapshot<ReceiptDocument>[],
//   shape: any = {}
// ) {
//   return docs.map((doc) => {
//     const data = doc.data();
//     const res: any = { id: doc.id };

//     /* ➊ Include fields (auto-map aliases) */
//     if (shape.includeFields === '*' || !shape.includeFields) {
//       Object.assign(res, data);
//     } else {
//       for (const f of shape.includeFields) {
//         const key = f === 'totalAmount' ? 'total' :
//                     f === 'vendorName'  ? 'vendor' : f;
//         // @ts-ignore for simplicity
//         res[f] = data[key];
//       }
//     }

//     /* ➋ Flatten items + gather stats */
//     let itemCount = 0;
//     let cheapest: { price: number; name: string; category?: string } | any = null;
//     let mostExpensive: typeof cheapest | null = null;

//     if (shape.flattenCategorizedItems) {
//       const flat: (ReceiptItem & { categoryName: string })[] = [];
//       const cats = data.categorization?.categories ?? {};

//       for (const [catName, items] of Object.entries(cats)) {
//         for (const item of items) {
//           if (!passesItemFilters(item, catName, shape.itemFilters)) continue;

//           flat.push({ ...item, categoryName: catName });

//           // stats
//           itemCount++;
//           if (!cheapest || item.price < cheapest.price) cheapest = { ...item, category: catName };
//           if (!mostExpensive || item.price > mostExpensive.price) mostExpensive = { ...item, category: catName };
//         }
//       }
//       res.categorizedItems = flat;
//     }

//     res.stats = { itemCount, cheapest, mostExpensive };
//     return res;
//   });
// }

// /* ---------- ➌  Helper: filter logic ---------- */
// function passesItemFilters(
//   item: ReceiptItem,
//   categoryName: string,
//   f: any = {}
// ) {
//   const categoryOk =
//     !f.categoryName ||
//     (Array.isArray(f.categoryName)
//       ? f.categoryName.includes(categoryName)
//       : f.categoryName === categoryName);

//   const priceOk =
//     (f.minPrice === undefined || item.price >= f.minPrice) &&
//     (f.maxPrice === undefined || item.price <= f.maxPrice);

//   const nameOk =
//     !f.nameContains ||
//     item.name.toLowerCase().includes(f.nameContains.toLowerCase());

//   return categoryOk && priceOk && nameOk;
// }

// export function cosineSimilarity(a: number[], b: number[]): number {
//   if (a.length !== b.length) return 0;

//   const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
//   const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai ** 2, 0));
//   const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi ** 2, 0));
//   return dot / (magA * magB);
// }

// async function summarizeResults(prompt: string, rows: any[]) {
//   // ---------- simple rule-based answers ----------
//   const lc = prompt.toLowerCase();
//   const allStats = rows.map(r => r.stats).filter(Boolean);

//   if (lc.includes('total item') && allStats.length) {
//     const total = allStats.reduce((n, s) => n + (s.itemCount || 0), 0);
//     return `You have ${total} receipt item${total !== 1 ? 's' : ''}.`;
//   }

//   if ((lc.includes('cheapest') || lc.includes('least expensive')) && allStats.length) {
//     const cheapest = allStats
//       .map(s => s.cheapest)
//       .filter(Boolean)
//       .sort((a, b) => a.price - b.price)[0];
//     if (cheapest) {
//       return `Your cheapest item is ₹${cheapest.price} – “${cheapest.name}” (${cheapest.category}).`;
//     }
//   }

//   if ((lc.includes('most expensive') || lc.includes('costliest')) && allStats.length) {
//     const priciest = allStats
//       .map(s => s.mostExpensive)
//       .filter(Boolean)
//       .sort((a, b) => b.price - a.price)[0];
//     if (priciest) {
//       return `Your most expensive item is ₹${priciest.price} – “${priciest.name}” (${priciest.category}).`;
//     }
//   }

//   if (lc.includes('most expensive') && rows.length > 0) {
//     const mostExpensiveReceipt = rows[0];
//     if (mostExpensiveReceipt && mostExpensiveReceipt.total) {
//       return `Your most expensive purchase was for ₹${mostExpensiveReceipt.total} at ${mostExpensiveReceipt.vendor}.`;
//     }
//   }

//   // ---------- fallback to Gemini for free-form summaries ----------
//   const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
//   const systemPrompt = `You are a helpful finance bot. Summarize the data in one friendly sentence.`;
//   const result = await model.generateContent([
//     systemPrompt,
//     `User asked: ${prompt}`,
//     `Data: ${JSON.stringify(rows, null, 2)}`
//   ]);

//   return result.response.text().trim();
// }
