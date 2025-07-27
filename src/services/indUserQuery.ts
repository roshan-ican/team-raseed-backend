import { embed } from '../lib/embed-vertex';
import { db } from '../lib/firebase-admin';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function resolveDateKeyword(keyword: string) {
  const today = new Date(), yr = today.getFullYear();
  const startOfWeek = (d: Date) => {
    const n = d.getDay(); const s = new Date(d); s.setDate(d.getDate() - n); s.setHours(0, 0, 0, 0); return s;
  };
  switch (keyword) {
    case 'this_week': return { start: startOfWeek(today), end: today };
    case 'last_week': {
      const end = new Date(startOfWeek(today)); end.setDate(end.getDate() - 1);
      const start = new Date(end); start.setDate(end.getDate() - 6); return { start, end };
    }
    case 'this_month': { const start = new Date(yr, today.getMonth(), 1); return { start, end: today }; }
    case 'last_month': {
      const start = new Date(yr, today.getMonth() - 1, 1);
      const end = new Date(yr, today.getMonth(), 0); return { start, end };
    }
    case 'this_quarter': {
      const q = Math.floor(today.getMonth() / 3); const start = new Date(yr, q * 3, 1);
      return { start, end: today };
    }
    case 'indian_fy': {
      const fyStart = new Date(today.getMonth() < 3 ? yr - 1 : yr, 3, 1);
      const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31, 23, 59, 59); return { start: fyStart, end: fyEnd };
    }
    default: return null;
  }
}

type Intent =
  | 'TOTAL_SPENDING'
  | 'AVERAGE_SPENDING'
  | 'CATEGORY_SPENDING'
  | 'PAYMENT_MODE_SPLIT'
  | 'MERCHANT_SPENDING'
  | 'THRESHOLD_EXPENSES'
  | 'MOST_EXPENSIVE'
  | 'AVERAGE_DAILY'
  | 'UNKNOWN'
  | 'CHEAPEST'
  | 'LAST_RECEIPT'

interface Cls {
  intent: Intent;
  filters: {
    dateKeyword?: string;
    category?: string;
    vendor?: string;
    paymentMode?: 'cash' | 'upi' | 'card' | 'digital';
    minAmount?: number;
  };
  aggregation?: 'sum' | 'avg' | 'count' | 'max';
}





type C = {
  type: 'where' | 'orderBy' | 'limit',
  field?: string,
  operator?: FirebaseFirestore.WhereFilterOp,
  value?: any,
  direction?: 'asc' | 'desc'
};







interface EmbeddingDoc {
  user_id: string;
  receipt_id: string;
  vendor: string;
  purchase_date: string;
  name: string;
  price: number;
  quantity: number;
  category_name: string;
  embedding: number[];
  created_at: any;
}

interface SearchHit extends Omit<EmbeddingDoc, 'embedding'> {
  id: string;
  similarity: number;
  distance: number;
}

interface RAGResult {
  success: boolean;
  summary: string;
  rawResults: SearchHit[];
  source: 'vector' | 'keyword' | 'hybrid';
  intent?: string;
  totalItems: number;
  error?: string;
}

// Cosine similarity calculation (more accurate than distance)
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Optimized vector search with batching
export async function fixedVectorSearch(
  queryEmbedding: number[],
  userId: string,
  limit: number = 50
): Promise<SearchHit[]> {
  console.log(`🔍 Starting vector search for user: ${userId}`);

  try {
    const results: SearchHit[] = [];
    const receiptsQuery = db.collection('receipts').where('userId', '==', userId);
    const receiptsSnapshot = await receiptsQuery.get();

    console.log(`📄 Found ${receiptsSnapshot.size} receipts to search`);

    if (receiptsSnapshot.empty) {
      console.log('⚠️ No receipts found for user');
      return [];
    }

    // Process receipts in batches
    const batchSize = 10;
    const receiptDocs = receiptsSnapshot.docs;

    console.log(`📋 Processing ${receiptDocs.length} receipts in batches of ${batchSize}`);

    for (let i = 0; i < receiptDocs.length; i += batchSize) {
      const batch = receiptDocs.slice(i, i + batchSize);

      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(receiptDocs.length / batchSize)}`);

      // Process batch in parallel
      // @ts-ignore
      const batchPromises = batch.map(async (receiptDoc) => {
        try {
          const embeddingsSnap = await receiptDoc.ref.collection('embeddings').get();

          if (embeddingsSnap.empty) {
            console.log(`⚠️ No embeddings found for receipt: ${receiptDoc.id}`);
            return [];
          }

          console.log(`📊 Found ${embeddingsSnap.size} embeddings in receipt: ${receiptDoc.id}`);
          // @ts-ignore

          return embeddingsSnap.docs.map(doc => {
            const data = doc.data() as EmbeddingDoc;

            console.log(data, "__data__")

            // Validate embedding data
            if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length === 0) {
              console.log(`⚠️ Invalid embedding for doc: ${doc.id}`);
              return null;
            }

            if (data.embedding.length !== queryEmbedding.length) {
              console.log(`⚠️ Embedding dimension mismatch: ${data.embedding.length} vs ${queryEmbedding.length}`);
              return null;
            }

            const similarity = cosineSimilarity(queryEmbedding, data.embedding);
            const distance = 1 - similarity;

            return {
              id: doc.id,
              user_id: data.user_id,
              receipt_id: data.receipt_id,
              vendor: data.vendor,
              purchase_date: data.purchase_date,
              name: data.name,
              price: data.price,
              quantity: data.quantity,
              category_name: data.category_name,
              created_at: data.created_at,
              similarity,
              distance
            } as SearchHit;
            // @ts-ignore

          }).filter(item => item !== null) as SearchHit[];

        } catch (error) {
          console.error(`❌ Error processing receipt ${receiptDoc.id}:`, error);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const flatResults = batchResults.flat();
      results.push(...flatResults);

      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${flatResults.length} items`);
    }

    // Sort by similarity (descending) and limit results
    const sortedResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`✅ Vector search completed: ${sortedResults.length} results from ${results.length} total`);
    console.log(`🎯 Top 3 similarities: ${sortedResults.slice(0, 3).map(r => r.similarity.toFixed(3)).join(', ')}`);

    return sortedResults;

  } catch (error) {
    console.error('❌ Vector search failed:', error);
    return [];
  }
}

// Dynamic threshold based on query type
function getDynamicThreshold(query: string): number {
  const lowerQuery = query.toLowerCase();

  // Specific product names need higher similarity
  if (/\b(brand|product|item)\b/.test(lowerQuery)) {
    return 0.8;
  }

  // Category searches can be more flexible
  if (/\b(category|type|kind)\b/.test(lowerQuery)) {
    return 0.6;
  }

  // Amount/price queries
  if (/\b(spent|cost|price|amount|expensive|cheap)\b/.test(lowerQuery)) {
    return 0.7;
  }

  // Date-based queries
  if (/\b(last|recent|yesterday|week|month)\b/.test(lowerQuery)) {
    return 0.65;
  }

  return 0.75; // Default threshold
}

// Enhanced context building with better formatting
function buildEnhancedContext(hits: SearchHit[], maxTokens: number = 2000): string {
  if (hits.length === 0) return "No relevant items found.";

  let context = '';
  let tokenCount = 0;

  // Group by category for better organization
  const groupedHits = hits.reduce((acc, hit) => {
    const category = hit.category_name || 'Others';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(hit);
    return acc;
  }, {} as Record<string, SearchHit[]>);

  for (const [category, items] of Object.entries(groupedHits)) {
    const categoryHeader = `\n📂 ${category.toUpperCase()}:\n`;
    if (tokenCount + categoryHeader.length > maxTokens) break;

    context += categoryHeader;
    tokenCount += categoryHeader.length;

    for (const item of items.slice(0, 10)) { // Limit items per category
      const itemText = `• ${item.name} - ₹${item.price.toLocaleString('en-IN')} (qty: ${item.quantity}) from ${item.vendor || 'Unknown'} [Relevance: ${(item.similarity * 100).toFixed(1)}%]\n`;
      if (tokenCount + itemText.length > maxTokens) break;

      context += itemText;
      tokenCount += itemText.length;
    }
  }

  return context.trim();
}


// Main optimized RAG function
export async function streamlinedRAGQuery(
  prompt: string,
  userId: string,
  embeddingFunction: (text: string) => Promise<number[]>
): Promise<RAGResult> {
  console.log(`🚀 Starting streamlined RAG query: "${prompt}" for user: ${userId}`);

  try {
    // Generate embedding for the query
    console.log('🔢 Generating query embedding...');
    const queryEmbedding = await embeddingFunction(prompt);
    console.log(`✅ Generated query embedding of length: ${queryEmbedding.length}`);

    // Perform vector search
    const vectorResults = await fixedVectorSearch(queryEmbedding, userId, 100);

    if (vectorResults.length === 0) {
      console.log('⚠️ No vector results found');
      return {
        success: true,
        summary: "I couldn't find any relevant items in your purchase history for that query. Try asking about specific products or categories you've bought before.",
        rawResults: [],
        source: 'vector',
        totalItems: 0
      };
    }

    // Apply dynamic threshold
    const threshold = getDynamicThreshold(prompt);
    const goodHits = vectorResults.filter(hit => hit.similarity >= threshold);

    console.log(`📊 Vector results: ${vectorResults.length} total, ${goodHits.length} above threshold (${threshold})`);

    // Use vector results if we have enough good hits
    if (goodHits.length >= 1) { // Lowered threshold for better results
      const context = buildEnhancedContext(goodHits);
      const summary = await generateEnhancedSummary(prompt, context, goodHits);

      return {
        success: true,
        summary,
        rawResults: goodHits,
        source: 'vector',
        totalItems: goodHits.length
      };
    }

    // If not enough good hits, use more results with lower threshold
    console.log('🔄 Using expanded vector results with lower threshold');
    const expandedHits = vectorResults.filter(hit => hit.similarity >= 0.5);

    if (expandedHits.length > 0) {
      const context = buildEnhancedContext(expandedHits);
      const summary = await generateEnhancedSummary(prompt, context, expandedHits);

      return {
        success: true,
        summary,
        rawResults: expandedHits,
        source: 'vector',
        totalItems: expandedHits.length
      };
    }

    // Final fallback
    return {
      success: false,
      summary: "Could not find in vector",
      rawResults: vectorResults.slice(0, 5), // Show top 5 anyway
      source: 'vector',
      totalItems: vectorResults.length
    };

  } catch (error: any) {
    console.error('❌ Streamlined RAG query failed:', error);
    return {
      success: false,
      error: error.message,
      summary: "I encountered an error processing your request. Please try again.",
      rawResults: [],
      source: 'vector',
      totalItems: 0
    };
  }
}



// Utility function for debugging your current data structure
export async function enhancedDebugDataStructure(uid: string) {
  console.log(`=== ENHANCED DEBUGGING FOR USER: ${uid} ===`);

  try {
    const receiptsQuery = db?.collection('receipts').where('userId', '==', uid);
    const receiptsSnapshot = await receiptsQuery.get();
    console.log(`📄 Found ${receiptsSnapshot.size} receipts`);

    let totalEmbeddings = 0;  
    let validEmbeddings = 0;
    const categories = new Set<string>();
    const vendors = new Set<string>();

    for (const receiptDoc of receiptsSnapshot.docs) {
      const embeddingsSnap = await receiptDoc.ref.collection('embeddings').get();
      totalEmbeddings += embeddingsSnap.size;

      embeddingsSnap.docs.forEach((doc: { data: () => any; }) => {
        const data = doc.data();
        if (data.embedding && data.embedding.length > 0) {
          validEmbeddings++;
        }
        if (data.category_name) categories.add(data.category_name);
        if (data.vendor) vendors.add(data.vendor);
      });
    }

    console.log(`📊 Summary:
    - Total embeddings: ${totalEmbeddings}
    - Valid embeddings: ${validEmbeddings}
    - Categories: ${categories.size} (${Array.from(categories).join(', ')})
    - Vendors: ${vendors.size} (${Array.from(vendors).join(', ')})
    - Embedding dimension: 768
    `);

    return {
      totalReceipts: receiptsSnapshot.size,
      totalEmbeddings,
      validEmbeddings,
      categories: Array.from(categories),
      vendors: Array.from(vendors)
    };

  } catch (error) {
    console.error('❌ Enhanced debug failed:', error);
    return null;
  }
}

async function generateEnhancedSummary(
  prompt: string,
  context: string,
  results: SearchHit[]
): Promise<string> {
  if (results.length === 0) {
    return "No relevant items found for your query.";
  }

  // Compute totals and averages
  const totalSpent = results.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalUnits = results.reduce((sum, item) => sum + item.quantity, 0);
  const avgPricePerUnit = totalSpent / totalUnits;

  // Unique categories & vendors
  const uniqueCategories = [...new Set(results.map(r => r.category_name))];
  const uniqueVendors = [...new Set(results.map(r => r.vendor).filter(Boolean))];

  // Build the AI prompt
  const enhancedPrompt = `
You are a helpful financial assistant analyzing purchase history. Provide a natural, conversational response.

PURCHASE DATA:
${context}

SUMMARY STATS:
- Items found: ${results.length}
- Total units: ${totalUnits}
- Total value: ₹${totalSpent.toLocaleString('en-IN')}
- Average price per unit: ₹${avgPricePerUnit.toFixed(2)}
- Categories: ${uniqueCategories.join(', ')}
- Vendors: ${uniqueVendors.join(', ')}

USER QUESTION: "${prompt}"

INSTRUCTIONS:
- Give a direct, helpful answer based on the data
- Include specific numbers and insights
- Be conversational and friendly
- If showing multiple items, group by category or highlight patterns
- Use Indian currency format (₹ symbol)
- Keep response under 200 words
`;

  try {
    const mdl = genAI.getGenerativeModel({ model: process.env.MODEL || "gemini-1.5-flash" });
    const res = await mdl.generateContent([enhancedPrompt]);
    return res.response.text()
      .replace(/\n+/g, ' ')             // Remove all newlines
      .replace(/\s+/g, ' ')             // Collapse multiple spaces
      .replace(/\s([.,!?])/g, '$1')     // Remove space before punctuation
      .trim();
  } catch (error) {
    console.error('❌ AI summary generation failed:', error);

    // Fallback summary
    const topItems = results.slice(0, 3);
    let fallback = `I found ${results.length} item${results.length > 1 ? 's' : ''} totaling ₹${totalSpent.toLocaleString('en-IN')}. `;
    fallback += `Top ${topItems.length > 1 ? 'items are' : 'item is'} `;
    fallback += topItems
      .map(item => `${item.name} (₹${item.price} × ${item.quantity})`)
      .join(', ');
    if (uniqueCategories.length > 1) {
      fallback += `. Spanning ${uniqueCategories.length} categories: ${uniqueCategories.join(', ')}`;
    }
    return fallback;
  }
}









