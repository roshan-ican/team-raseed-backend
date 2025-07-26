import { Timestamp } from 'firebase-admin/firestore';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

export interface VideoMetadata {
  originalFilename: string;
  storedName: string;
  durationSec?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  frameSourceTime?: number;
}

export interface CategorizationResult {
  categories: {
    [categoryName: string]: ReceiptItem[];
  };
  summary: {
    total_categories: number;
    total_items: number;
  };
}

export interface ReceiptDocument {
  // User connection
  userId: string;                    // Links to UserProfile
  
  // Receipt metadata
  vendor?: string;
  receiptDate?: Timestamp;
  total?: number;
  subtotal?: number;
  tax?: number;
  currency: string;
  
  // Processing information
  filename: string;
  isVideo: boolean;
  video?: VideoMetadata;
  rawText?: string;
  processingStatus: 'pending' | 'processed' | 'error';
  
  // AI Categorization results
  categorization: CategorizationResult;
  
  // Optional fields
  originalImageUrl?: string;
  insightsPassId?: string;
  
  // Firestore timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type NewReceiptDocument = Omit<ReceiptDocument, 'createdAt' | 'updatedAt'>;
