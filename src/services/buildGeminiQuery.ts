async function generateSummary(
  prompt: string,
  result: any,
  query: DynamicQuery
): Promise<string> {
  const { items, grouped, isGrouped } = result;

  if (!items || items.length === 0) {
    return "No expenses found matching your query.";
  }

  // Handle different query types
  if (query.queryType === 'recipe') {
    return await generateRecipeSummary(prompt, items, query);
  } else if (query.queryType === 'household') {
    return await generateHouseholdSummary(prompt, items, query);
  } else if (query.queryType === 'inventory') {
    return await generateInventorySummary(prompt, items, query);
  }

  // Handle grouped results
  if (isGrouped && grouped) {
    const groups = Object.values(grouped);
    const model = genAI.getGenerativeModel({ model: process.env.MODEL });

    const groupSummary = groups.map((g: any) => ({
      group: g.groupValues,
      count: g.metrics.count,
      total: g.metrics.totalAmount,
      average: g.metrics.avgAmount
    }));

    const res = await model.generateContent([
      `Summarize this grouped expense data based on the user's query.`,
      `User Query: ${prompt}`,
      `Query Intent: ${query.queryIntent}`,
      `Grouped Data: ${JSON.stringify(groupSummary, null, 2)}`,
      `Provide a clear, concise summary in Indian currency format.`
    ]);

    return res.response.text().trim();
  }

  // Handle aggregations
  if (query.operations.aggregation) {
    const total = items.reduce((sum: any, item: { price: any; }) => sum + item.price, 0)
    const count = items.length;

    switch (query.operations.aggregation) {
      case 'sum':
        return `Total amount: ₹${total.toLocaleString('en-IN')} across ${count} items.`;
      case 'avg':
        return `Average amount: ₹${(total / count).toFixed(2)} across ${count} items.`;
      case 'count':
        return `Found ${count} items matching your criteria.`;
      case 'max':
        const max = Math.max(...items.map((i: any) => i.price));
        const maxItem = items.find((i: any) => i.price === max);
        return `Highest amount: ₹${max.toLocaleString('en-IN')} for ${maxItem.name}.`;
      case 'min':
        const min = Math.min(...items.map((i: any) => i.price));
        const minItem = items.find((i: any) => i.price === min);
        return `Lowest amount: ₹${min.toLocaleString('en-IN')} for ${minItem.name}.`;
    }
  }

  // Handle specific queries based on intent
  if (query.queryIntent?.toLowerCase().includes('last') ||
    query.queryIntent?.toLowerCase().includes('recent')) {
    const item = items[0];
    return `Your last purchase was ${item.name} for ₹${item.price.toLocaleString('en-IN')} from ${item.vendor || 'Unknown vendor'} on ${item.date}.`;
  }

  // Default summary using AI
  const model = genAI.getGenerativeModel({ model: process.env.MODEL });
  const sampleItems = items.slice(0, 5).map((i: any) =>
    `${i.name} - ₹${i.price} (${i.vendor || 'Unknown'})`
  ).join(', ');

  const res = await model.generateContent([
    `Provide a clear summary of this expense data based on the user's query.`,
    `User Query: ${prompt}`,
    `Query Intent: ${query.queryIntent}`,
    `Results: ${items.length} items, Total: ₹${items.reduce((s: any, i: { price: any; }) => s + i.price, 0).toLocaleString('en-IN')}`,
    `Sample items: ${sampleItems}`,
    `Give a natural, conversational response in 1-2 sentences.`
  ]);

  return res.response.text().trim();
}

async function generateRecipeSummary(prompt: string, items: any[], query: DynamicQuery): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL });
  
  // Group items by name and sum quantities
  const inventory: { [key: string]: number } = {};
  items.forEach(item => {
    const name = item.name.toLowerCase();
    inventory[name] = (inventory[name] || 0) + item.quantity;
  });
  
  const inventoryList = Object.entries(inventory)
    .map(([name, qty]) => `${name} (${qty})`)
    .join(', ');

  if (query.operations.analysis === 'recipe_suggestions') {
    const res = await model.generateContent([
      `Based on these ingredients, suggest 3-5 recipes the user can cook.`,
      `Available ingredients: ${inventoryList}`,
      `Consider Indian cuisine and common recipes.`,
      `Format: List recipe names with main ingredients used from their inventory.`
    ]);
    return res.response.text().trim();
  } else if (query.operations.analysis === 'missing_ingredients') {
    const res = await model.generateContent([
      `User wants to cook: ${prompt}`,
      `Current inventory: ${inventoryList}`,
      `List what ingredients they need to buy to make this dish.`,
      `Format: "To make [dish], you need to buy: [missing ingredients]"`
    ]);
    return res.response.text().trim();
  }
  
  // Default recipe summary
  return `You have ${items.length} food items including: ${inventoryList.slice(0, 100)}...`;
}

async function generateHouseholdSummary(prompt: string, items: any[], query: DynamicQuery): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL });
  
  // Calculate total quantity for household items
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const mostRecent = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  
  if (query.operations.analysis === 'inventory_check') {
    const itemNames = items.map(i => i.name).join(', ');
    
    const res = await model.generateContent([
      `User asked: ${prompt}`,
      `Found these items: ${itemNames}`,
      `Total quantity: ${totalQuantity}`,
      `Most recent purchase: ${mostRecent.name} on ${mostRecent.date}`,
      `Provide a helpful answer about whether they have enough for their needs.`,
      `Consider typical usage patterns for the item type.`
    ]);
    return res.response.text().trim();
  }
  
  return `You have ${totalQuantity} units of ${items[0]?.name || 'household items'}. Last purchased on ${mostRecent.date}.`;
}

async function generateInventorySummary(prompt: string, items: any[], query: DynamicQuery): Promise<string> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL });
  
  // Group by item name and calculate totals
  const inventory: { [key: string]: { quantity: number, lastDate: string } } = {};
  
  items.forEach(item => {
    const name = item.name.toLowerCase();
    if (!inventory[name]) {
      inventory[name] = { quantity: 0, lastDate: item.date };
    }
    inventory[name].quantity += item.quantity;
    if (new Date(item.date) > new Date(inventory[name].lastDate)) {
      inventory[name].lastDate = item.date;
    }
  });
  
  const inventorySummary = Object.entries(inventory)
    .map(([name, data]) => `${name}: ${data.quantity} units (last: ${data.lastDate})`)
    .join('\n');
  
  const res = await model.generateContent([
    `Summarize this inventory data based on user query.`,
    `User Query: ${prompt}`,
    `Inventory:\n${inventorySummary}`,
    `Provide a helpful, concise summary.`
  ]);
  
  return res.response.text().trim();
}import { db } from '../lib/firebase-admin';
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function resolveDateKeyword(keyword: string) {
  const today = new Date(), yr = today.getFullYear();
  const startOfWeek = (d: Date) => {
    const n = d.getDay(); const s = new Date(d); s.setDate(d.getDate() - n); s.setHours(0, 0, 0, 0); return s;
  };
  
  // Handle custom date keywords
  switch (keyword) {
    case 'this_week': return { start: startOfWeek(today), end: today };
    case 'last_week': {
      const end = new Date(startOfWeek(today)); end.setDate(end.getDate() - 1);
      const start = new Date(end); start.setDate(end.getDate() - 6); return { start, end };
    }
    case 'last_two_weeks': {
      const start = new Date(today);
      start.setDate(today.getDate() - 14);
      return { start, end: today };
    }
    case 'last_three_days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 3);
      return { start, end: today };
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

// Dynamic query structure that can handle any type of query
interface DynamicQuery {
  filters: {
    dateKeyword?: string;
    dateRange?: { start?: Date; end?: Date };
    category?: string;
    merchants?: string[];
    paymentMode?: string;
    amountRange?: { min?: number; max?: number };
    itemTypes?: string[]; // food, household, laundry, etc.
    itemNames?: string[]; // specific item names to search for
    [key: string]: any; // Allow any additional filters
  };
  operations: {
    aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
    groupBy?: string[];
    orderBy?: { field: string; direction: 'asc' | 'desc' }[];
    limit?: number;
    select?: string[]; // Which fields to return
    analysis?: 'recipe_suggestions' | 'missing_ingredients' | 'inventory_check' | 'financial';
  };
  queryIntent?: string; // Keep for context but not hardcoded
  queryType?: 'financial' | 'inventory' | 'recipe' | 'household';
}

function cleanAiJsonResponse(s: string) {
  return s
    .replace(/^```json[\r\n]*/i, '')
    .replace(/^```[\r\n]*/i, '')
    .replace(/```[\r\n]*$/g, '')
    .trim();
}

function truncateAfterFirstJsonBlock(s: string) {
  const end = s.lastIndexOf('}');
  return end !== -1 ? s.slice(0, end + 1) : s;
}

async function parseNaturalQuery(prompt: string): Promise<DynamicQuery> {
  const model = genAI.getGenerativeModel({ model: process.env.MODEL });
  
  const sys = `
You are a query parser for a personal finance tracking system. Convert natural language queries into structured query objects.

The data structure has these fields:
- name: item name
- price: item price
- quantity: item quantity
- category: expense category
- vendor: merchant/shop name
- date: transaction date (YYYY-MM-DD format)
- createdAt: timestamp
- amount: total receipt amount
- userId: user identifier
- receiptId: receipt identifier

Convert the user's query into this JSON structure:
{
  "filters": {
    "dateKeyword": "last_week|this_month|last_month|this_quarter|indian_fy", // or use dateRange
    "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
    "category": "food|transport|shopping|etc",
    "merchants": ["vendor1", "vendor2"],
    "amountRange": { "min": 100, "max": 1000 }
  },
  "operations": {
    "aggregation": "sum|avg|count|max|min",
    "groupBy": ["category", "vendor"], // fields to group by
    "orderBy": [{ "field": "date", "direction": "desc" }], // can have multiple
    "limit": 10, // how many results
    "select": ["name", "price", "date"] // which fields to return
  },
  "queryIntent": "describe what the user wants in simple terms"
}

Examples:

User: "what was my last purchase"
{
  "filters": {},
  "operations": {
    "orderBy": [{ "field": "date", "direction": "desc" }],
    "limit": 1
  },
  "queryIntent": "Get the most recent purchase"
}

User: "total spending on food this month"
{
  "filters": {
    "dateKeyword": "this_month",
    "category": "food"
  },
  "operations": {
    "aggregation": "sum"
  },
  "queryIntent": "Calculate total food expenses for current month"
}

User: "show me all purchases above 500 rupees last week grouped by category"
{
  "filters": {
    "dateKeyword": "last_week",
    "amountRange": { "min": 500 }
  },
  "operations": {
    "groupBy": ["category"],
    "orderBy": [{ "field": "price", "direction": "desc" }]
  },
  "queryIntent": "List expensive purchases from last week grouped by category"
}

User: "average daily spending"
{
  "filters": {},
  "operations": {
    "aggregation": "avg",
    "groupBy": ["date"]
  },
  "queryIntent": "Calculate average spending per day"
}

User: "top 5 most expensive items"
{
  "filters": {},
  "operations": {
    "orderBy": [{ "field": "price", "direction": "desc" }],
    "limit": 5
  },
  "queryIntent": "Get 5 most expensive individual items"
}

Respond only with valid JSON.`;

  const txt = (await model.generateContent([sys, prompt])).response.text();
  const cleaned = truncateAfterFirstJsonBlock(cleanAiJsonResponse(txt));

  try {
    console.log('[parseNaturalQuery()] Parsed query:\n', cleaned);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[parseNaturalQuery()] Failed to parse:\n', cleaned);
    // Return a basic query as fallback
    return {
      filters: {},
      operations: { limit: 10 },
      queryIntent: prompt
    };
  }
}

type QueryConstraint = {
  type: 'where' | 'orderBy' | 'limit',
  field?: string,
  operator?: FirebaseFirestore.WhereFilterOp,
  value?: any,
  direction?: 'asc' | 'desc'
};

function buildDynamicQuery(uid: string, query: DynamicQuery) {
  const constraints: QueryConstraint[] = [
    { type: 'where', field: 'userId', operator: '==', value: uid }
  ];
  
  const postProcessing: any = {
    filters: {},
    operations: query.operations
  };

  // Handle date filters
  if (query.filters.dateKeyword) {
    const range = resolveDateKeyword(query.filters.dateKeyword);
    if (range) {
      constraints.push({ 
        type: 'where', 
        field: 'date', 
        operator: '>=', 
        value: range.start.toISOString().split('T')[0] 
      });
      constraints.push({ 
        type: 'where', 
        field: 'date', 
        operator: '<=', 
        value: range.end.toISOString().split('T')[0] 
      });
    }
  } else if (query.filters.dateRange) {
    if (query.filters.dateRange.start) {
      constraints.push({ 
        type: 'where', 
        field: 'date', 
        operator: '>=', 
        value: query.filters.dateRange.start 
      });
    }
    if (query.filters.dateRange.end) {
      constraints.push({ 
        type: 'where', 
        field: 'date', 
        operator: '<=', 
        value: query.filters.dateRange.end 
      });
    }
  }

  // Handle ordering (Firestore supports only one orderBy with where clauses)
  if (query.operations.orderBy && query.operations.orderBy.length > 0) {
    const primaryOrder = query.operations.orderBy[0];
    constraints.push({ 
      type: 'orderBy', 
      field: primaryOrder.field, 
      direction: primaryOrder.direction 
    });
    
    // Store additional orderings for post-processing
    if (query.operations.orderBy.length > 1) {
      postProcessing.additionalOrderBy = query.operations.orderBy.slice(1);
    }
  }

  // Handle limit
  if (query.operations.limit) {
    constraints.push({ type: 'limit', value: query.operations.limit });
  }

  // Store filters that need post-processing
  postProcessing.filters = {
    category: query.filters.category,
    merchants: query.filters.merchants,
    amountRange: query.filters.amountRange,
    paymentMode: query.filters.paymentMode
  };

  return { constraints, postProcessing };
}

async function fetchDocuments(constraints: QueryConstraint[], userId: string) {
  console.log('Fetching documents with constraints:', constraints);

  try {
    let q: FirebaseFirestore.Query = db.collection('receipts');

    // First, try the full query
    constraints.forEach(c => {
      if (c.type === 'where' && c.field && c.operator && c.value !== undefined) {
        q = q.where(c.field, c.operator, c.value);
      } else if (c.type === 'orderBy' && c.field) {
        q = q.orderBy(c.field, c.direction || 'asc');
      } else if (c.type === 'limit' && c.value) {
        q = q.limit(c.value);
      }
    });

    const result = await q.get();
    console.log(`Fetched ${result.docs.length} receipts`);
    return result.docs;

  } catch (e: any) {
    console.error('Query failed:', e);
    
    // Handle index errors specifically
    if (e.code === 9) {
      console.log('Index missing, trying fallback strategies...');
      
      // Strategy 1: Remove orderBy and handle sorting in post-processing
      try {
        let fallbackQuery: FirebaseFirestore.Query = db.collection('receipts');
        const hasOrderBy = constraints.some(c => c.type === 'orderBy');
        const orderByConstraint = constraints.find(c => c.type === 'orderBy');
        
        // Apply only where clauses
        constraints
          .filter(c => c.type === 'where')
          .forEach(c => {
            fallbackQuery = fallbackQuery.where(c.field!, c.operator!, c.value);
          });
        
        const result = await fallbackQuery.get();
        console.log(`Fallback without orderBy found ${result.docs.length} receipts`);
        
        // Store the orderBy info for post-processing
        if (hasOrderBy && orderByConstraint) {
          result.docs.forEach((doc: any) => {
            doc._orderBy = orderByConstraint;
          });
        }
        
        return result.docs;
        
      } catch (e2: any) {
        console.error('Fallback with where clauses failed:', e2);
        
        // Strategy 2: Just get all user's receipts
        try {
          const basicQuery = db.collection('receipts').where('userId', '==', userId);
          const result = await basicQuery.get();
          console.log(`Basic userId query found ${result.docs.length} receipts`);
          
          // Store constraints for post-processing
          result.docs.forEach((doc: any) => {
            doc._constraints = constraints;
          });
          
          return result.docs;
        } catch (e3: any) {
          console.error('Even basic query failed:', e3);
          throw e3;
        }
      }
    }
    throw e;
  }
}

function processDocuments(docs: any[], postProcessing: any) {
  let items: any[] = [];

  // Check if we need to apply deferred constraints (from fallback)
  const deferredOrderBy = docs.length > 0 && docs[0]._orderBy;
  const deferredConstraints = docs.length > 0 && docs[0]._constraints;

  // Flatten receipts into individual items
  docs.forEach(doc => {
    const receipt = doc.data();
    const receiptItems = receipt.items || [];
    
    receiptItems.forEach((item: any) => {
      items.push({
        // Item fields
        name: item.name,
        price: item.price || 0,
        quantity: item.quantity || 1,
        total: (item.price || 0) * (item.quantity || 1),
        
        // Receipt fields
        category: receipt.category,
        vendor: receipt.vendor,
        date: receipt.date,
        createdAt: receipt.createdAt,
        receiptId: receipt.receiptId || doc.id,
        receiptTotal: receipt.amount,
        
        // Metadata
        userId: receipt.userId,
        paymentMode: receipt.paymentMode
      });
    });
  });

  console.log(`Flattened to ${items.length} items`);

  // Apply deferred date filters if we had to fallback
  if (deferredConstraints) {
    const dateConstraints = deferredConstraints.filter((c: any) => 
      c.type === 'where' && c.field === 'date'
    );
    
    dateConstraints.forEach((c: any) => {
      items = items.filter(item => {
        const itemDate = item.date;
        if (!itemDate) return false;
        
        if (c.operator === '>=') {
          return itemDate >= c.value;
        } else if (c.operator === '<=') {
          return itemDate <= c.value;
        }
        return true;
      });
    });
  }

  // Apply post-processing filters
  items = items.filter(item => {
    const filters = postProcessing.filters;
    
    if (filters.category && item.category !== filters.category) return false;
    
    if (filters.merchants && filters.merchants.length > 0) {
      const vendorLower = (item.vendor || '').toLowerCase();
      if (!filters.merchants.some((m: string) => vendorLower.includes(m.toLowerCase()))) {
        return false;
      }
    }
    
    if (filters.amountRange) {
      if (filters.amountRange.min && item.price < filters.amountRange.min) return false;
      if (filters.amountRange.max && item.price > filters.amountRange.max) return false;
    }
    
    if (filters.paymentMode && item.paymentMode !== filters.paymentMode) return false;
    
    return true;
  });

  // Apply deferred orderBy if needed
  if (deferredOrderBy || postProcessing.operations.orderBy) {
    const orderBy = deferredOrderBy || postProcessing.operations.orderBy[0];
    
    items.sort((a, b) => {
      const aVal = a[orderBy.field];
      const bVal = b[orderBy.field];
      
      if (orderBy.direction === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });
  }

  // Apply additional sorting if needed
  if (postProcessing.additionalOrderBy) {
    items.sort((a, b) => {
      for (const order of postProcessing.additionalOrderBy) {
        const aVal = a[order.field];
        const bVal = b[order.field];
        if (aVal !== bVal) {
          return order.direction === 'desc' ? 
            (bVal > aVal ? 1 : -1) : 
            (aVal > bVal ? 1 : -1);
        }
      }
      return 0;
    });
  }

  // Apply limit if specified in operations
  if (postProcessing.operations.limit && items.length > postProcessing.operations.limit) {
    items = items.slice(0, postProcessing.operations.limit);
  }

  // Apply grouping if needed
  if (postProcessing.operations.groupBy && postProcessing.operations.groupBy.length > 0) {
    const grouped = groupByFields(items, postProcessing.operations.groupBy);
    return { items, grouped, isGrouped: true };
  }

  return { items, isGrouped: false };
}

function groupByFields(items: any[], fields: string[]) {
  const grouped: any = {};
  
  items.forEach(item => {
    const key = fields.map(f => item[f] || 'unknown').join('_');
    if (!grouped[key]) {
      grouped[key] = {
        groupKey: key,
        groupValues: fields.reduce((acc, f) => ({ ...acc, [f]: item[f] }), {}),
        items: [],
        metrics: {
          count: 0,
          totalAmount: 0,
          avgAmount: 0,
          minAmount: Infinity,
          maxAmount: -Infinity
        }
      };
    }
    
    grouped[key].items.push(item);
    grouped[key].metrics.count++;
    grouped[key].metrics.totalAmount += item.price;
    grouped[key].metrics.minAmount = Math.min(grouped[key].metrics.minAmount, item.price);
    grouped[key].metrics.maxAmount = Math.max(grouped[key].metrics.maxAmount, item.price);
  });
  
  // Calculate averages
  Object.values(grouped).forEach((group: any) => {
    group.metrics.avgAmount = group.metrics.totalAmount / group.metrics.count;
  });
  
  return grouped;
}



export async function generateFireStoreQuery(prompt: string, userId: string) {
  try {
    console.log(`Processing query: "${prompt}" for user: ${userId}`);

    // Parse natural language to structured query
    const query = await parseNaturalQuery(prompt);
    console.log('Parsed query:', JSON.stringify(query, null, 2));

    // Build Firestore constraints and post-processing rules
    const { constraints, postProcessing } = buildDynamicQuery(userId, query);

    // Fetch documents
    const docs = await fetchDocuments(constraints, userId);

    // Process documents (filter, sort, group)
    const result = processDocuments(docs, postProcessing);

    // Generate natural language summary
    const summary = await generateSummary(prompt, result, query);

    return {
      success: true,
      summary,
      data: {
        items: result.items,
        grouped: result.grouped,
        totalItems: result.items.length,
        query: query
      },
      debug: {
        parsedQuery: query,
        constraints,
        documentCount: docs.length
      }
    };

  } catch (err: any) {
    console.error('[generateFireStoreQuery] Error:', err);
    return {
      success: false,
      error: err.message,
      summary: "I encountered an error processing your request. Please try again."
    };
  }
}