export interface DashboardResponse {
  // Key metrics for the cards
  metrics: {
    totalSpending: number; // e.g., 2847.50
    totalReceipts: number; // e.g., 247
    averageReceiptAmount: number; // e.g., 11.53
    pendingReceipts: number; // e.g., 5
    spendingGrowthPercentage: number; // e.g., 12.5 or -5.2
    receiptsGrowth: number; // e.g., 8 or -3
    avgGrowthPercentage: number; // e.g., -2.3 or 4.1
  };

  // Categories for pie chart
  categoryBreakdown: Array<{
    category: string; // e.g., "Groceries"
    totalAmount: number; // e.g., 856.23
    receiptCount: number; // e.g., 23
  }>;

  // Monthly/daily trend for bar chart
  monthlyTrend: Array<{
    month: string; // e.g., "Jan 2024" or "Jul 23" for daily
    totalAmount: number; // e.g., 445.67
    receiptCount: number; // e.g., 12
  }>;

  // Recent receipts list
  recentReceipts: Array<{
    id: string; // e.g., "receipt_123"
    vendor: string; // e.g., "Walmart"
    category: string; // e.g., "Groceries"
    amount: number; // e.g., 45.67
    date: string; // e.g., "Jul 20, 2024"
    status: "processed" | "pending"; // Receipt status
  }>;

  // Available categories for dropdown
  availableCategories: string[]; // e.g., ["Groceries", "Transport", "Utilities"]
}
