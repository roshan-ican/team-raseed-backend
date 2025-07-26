import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ------------------- INTERFACES -------------------

export interface DashboardParams {
  timeRange: "7d" | "30d" | "90d" | "1y" | "all";
  selectedCategory?: string;
}

export interface DashboardResponse {
  metrics: {
    totalSpending: number;
    totalReceipts: number;
    averageReceiptAmount: number;
    pendingReceipts: number;
    spendingGrowthPercentage: number;
    receiptsGrowth: number;
    avgGrowthPercentage: number;
  };
  categoryBreakdown: Array<{
    category_name: string;
    totalAmount: number;
    receiptCount: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    totalAmount: number;
    receiptCount: number;
  }>;
  recentReceipts: Array<{
    id: string;
    vendor: string;
    category_name: string;
    amount: number;
    date: string;
    status: "processed" | "pending" | string;
  }>;
  availableCategories: string[];
}

interface ReceiptItem {
  name: string;
  price: number;
  quantity?: number;
  category_name: string;
}

interface Receipt {
  id: string;
  vendor: string;
  date?: string;
  amount: number;
  items: ReceiptItem[];
  notes?: string;
  confidence?: number;
  userId: string;
  createdAt?: any; // Firestore Timestamp
  processingStatus?: string;
}

// ------------------- FIXED CATEGORIES -------------------

const FIXED_CATEGORIES = [
  "Groceries & Pantry",
  "Beverages",
  "Personal Care & Beauty",
  "Health & Wellness",
  "Home & Cleaning Supplies",
  "Baby Kids & Maternity",
  "Fashion & Accessories",
  "Electronics & Gadgets",
  "Home & Kitchen Appliances",
  "Pets Garden & Auto",
  "Miscellaneous & Extras",
];

// ------------------- MAIN FUNCTION -------------------

export async function getDashboardData(
  userId: string,
  params: DashboardParams
): Promise<DashboardResponse> {
  const { timeRange, selectedCategory } = params;

  // Time range
  const now = new Date();
  let startDate: Date | null = null;
  switch (timeRange) {
    case "7d":
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case "30d":
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case "90d":
      startDate = new Date(now.setDate(now.getDate() - 90));
      break;
    case "1y":
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const receiptsRef = collection(db, "receipts");
  let receiptQuery = query(
    receiptsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  if (startDate) {
    receiptQuery = query(
      receiptQuery,
      where("createdAt", ">=", Timestamp.fromDate(startDate))
    );
  }

  const snapshot = await getDocs(receiptQuery);

  const allReceipts: Receipt[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      vendor: data.vendor || "",
      date: data.date || "",
      amount: Number(data.amount) || 0,
      items: Array.isArray(data.items)
        ? data.items.map((item) => ({
            name: item.name || "",
            price: Number(item.price) || 0,
            quantity: item.quantity ?? 1,
            category_name: item.category_name || "Uncategorized",
          }))
        : [],
      notes: data.notes || "",
      confidence: Number(data.confidence) || 0,
      userId: data.userId || "",
      createdAt: data.createdAt || null,
      processingStatus: data.processingStatus || "processed",
    };
  });

  // Filter by category_name if given
  const filteredReceipts = selectedCategory
    ? allReceipts.filter((r) =>
        r.items.some((item) => item.category_name === selectedCategory)
      )
    : allReceipts;

  // METRICS
  const totalSpending = filteredReceipts.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  );
  const totalReceipts = filteredReceipts.length;
  const averageReceiptAmount =
    totalReceipts > 0 ? totalSpending / totalReceipts : 0;
  const pendingReceipts = filteredReceipts.filter(
    (r) => r.processingStatus === "pending"
  ).length;

  // CATEGORY BREAKDOWN
  const categoryMap: Record<string, { total: number; count: number }> = {};

  for (const r of filteredReceipts) {
    for (const item of r.items || []) {
      if (selectedCategory && item.category_name !== selectedCategory) continue;
      const cat = item.category_name || "Uncategorized";
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat].total += Number(item.price) * (item.quantity || 1);
      categoryMap[cat].count += 1;
    }
  }

  const categoryBreakdown = Object.entries(categoryMap).map(
    ([category_name, data]) => ({
      category_name,
      totalAmount: parseFloat((Number(data.total) || 0).toFixed(2)),
      receiptCount: data.count,
    })
  );

  // MONTHLY TREND
  const monthlyMap: Record<string, { total: number; count: number }> = {};

  for (const r of filteredReceipts) {
    const rawDate = r.date || r.createdAt?.toDate?.();
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    const key = date.toLocaleString("default", {
      month: "short",
      year: "numeric",
    });

    if (!monthlyMap[key]) monthlyMap[key] = { total: 0, count: 0 };
    monthlyMap[key].total += Number(r.amount) || 0;
    monthlyMap[key].count += 1;
  }

  const monthlyTrend = Object.entries(monthlyMap)
    .map(([month, data]) => ({
      month,
      totalAmount: parseFloat((Number(data.total) || 0).toFixed(2)),
      receiptCount: data.count,
    }))
    .sort(
      (a, b) =>
        new Date(`1 ${a.month}`).getTime() - new Date(`1 ${b.month}`).getTime()
    );

  // GROWTH STATS
  const sorted = [...filteredReceipts].sort(
    (a, b) =>
      (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );
  const recent = sorted.slice(0, 5);
  const prev = sorted.slice(5, 10);

  const currSpend = recent.reduce((s, r) => s + (r.amount || 0), 0);
  const prevSpend = prev.reduce((s, r) => s + (r.amount || 0), 0);
  const spendingGrowthPercentage =
    prevSpend > 0 ? ((currSpend - prevSpend) / prevSpend) * 100 : 0;

  const receiptsGrowth = recent.length - prev.length;

  const prevAvg =
    prev.length > 0
      ? prev.reduce((s, r) => s + (r.amount || 0), 0) / prev.length
      : 0;
  const avgGrowthPercentage =
    prevAvg > 0 ? ((averageReceiptAmount - prevAvg) / prevAvg) * 100 : 0;

  // RECENT RECEIPTS
  const recentReceipts = recent.map((r) => {
    const date =
      r.date ||
      r.createdAt?.toDate?.()?.toDateString?.() ||
      new Date().toDateString();

    return {
      id: r.id,
      vendor: r.vendor || "",
      category_name: r.items?.[0]?.category_name || "Uncategorized",
      amount: r.amount || 0,
      date,
      status: r.processingStatus === "pending" ? "pending" : "processed",
    };
  });

  // RETURN FINAL DASHBOARD DATA
  return {
    metrics: {
      totalSpending: parseFloat((Number(totalSpending) || 0).toFixed(2)),
      totalReceipts,
      averageReceiptAmount: parseFloat(
        (Number(averageReceiptAmount) || 0).toFixed(2)
      ),
      pendingReceipts,
      spendingGrowthPercentage: parseFloat(
        (Number(spendingGrowthPercentage) || 0).toFixed(2)
      ),
      receiptsGrowth,
      avgGrowthPercentage: parseFloat(
        (Number(avgGrowthPercentage) || 0).toFixed(2)
      ),
    },
    categoryBreakdown,
    monthlyTrend,
    recentReceipts,
    availableCategories: FIXED_CATEGORIES,
  };
}
