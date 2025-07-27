export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  category_name: string;
  tax_amount?: number;
  tax_rate?: number;
}

export interface Receipt {
  receiptId: string;
  userId: string;
  vendor: string;
  date: string; // ISO date string
  subtotal: number; // Amount before tax
  tax_amount: number; // Total tax amount (mandatory)
  tax_rate?: number; // Tax percentage (optional)
  total_amount: number; // Final amount including tax
  items: ReceiptItem[];
  notes?: string;
  confidence?: number;
  created_at?: any; // Firestore Timestamp
  updated_at?: any; // Firestore Timestamp
}

export interface ReceiptEmbedding {
  user_id: string;
  receipt_id: string;
  vendor: string;
  purchase_date: any; // Firestore Timestamp
  name: string;
  price: number;
  quantity: number;
  category_name: string;
  tax_amount?: number;
  embedding: number[];
  created_at: any; // Firestore Timestamp
  updated_at: any; // Firestore Timestamp
}
export const normalizeReceiptData = (data: any) => {
  return {
    ...data,
    tax_amount: typeof data.tax_amount === 'number' ? data.tax_amount : 0,
    subtotal: data.subtotal || data.total_amount || 0,
    total_amount: data.total_amount || (data.subtotal || 0) + (data.tax_amount || 0),
  };
};

// Updated validation schemas
export const validateReceiptData = (data: any): { isValid: boolean; errors: string[]; normalizedData: any } => {
  const errors: string[] = [];

  // Normalize data first
  const normalizedData = normalizeReceiptData(data) as any

  if (!normalizedData.userId) errors.push('userId is required');
  if (!normalizedData.date) errors.push('date is required');

  // Tax amount validation - now accepts 0 as valid
  if (typeof normalizedData.tax_amount !== 'number' || normalizedData.tax_amount < 0) {
    errors.push('tax_amount must be a non-negative number (defaults to 0 if not provided)');
  }

  if (typeof normalizedData.total_amount !== 'number' || normalizedData.total_amount < 0) {
    errors.push('total_amount must be a positive number');
  }

  if (!Array.isArray(normalizedData.items) || normalizedData.items.length === 0) {
    errors.push('items array is required and cannot be empty');
  }

  // Validate items
  normalizedData.items?.forEach((item: any, index: number) => {
    if (!item.name) errors.push(`Item ${index + 1}: name is required`);
    if (typeof item.price !== 'number' || item.price < 0) {
      errors.push(`Item ${index + 1}: price must be a positive number`);
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: quantity must be a positive number`);
    }
    if (!item.category_name) errors.push(`Item ${index + 1}: category_name is required`);
  });

  // Validate that total_amount = subtotal + tax_amount (if all are provided)
  if (normalizedData.subtotal !== undefined && normalizedData.tax_amount !== undefined && normalizedData.total_amount !== undefined) {
    const calculatedTotal = normalizedData.subtotal + normalizedData.tax_amount;
    if (Math.abs(calculatedTotal - normalizedData.total_amount) > 0.01) {
      errors.push('total_amount must equal subtotal + tax_amount');
    }
  }

  return { isValid: errors.length === 0, errors, normalizedData };
};

