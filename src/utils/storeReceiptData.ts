import { FieldValue, Timestamp, WriteBatch } from "firebase-admin/firestore";
import { db } from "../lib/firebase-admin";
import { embed } from "../lib/embed-vertex";

interface Receipt {
  user_id: string;
  name: string;
  total_price: number;
  total_items: number;
  merchant_name?: string;
  currency?: string;
  receipt_date?: string;
}

interface Category {
  name: string;
  user_id: string;
}

interface Item {
  name: string;
  price: number;
  rate: number;
  quantity: number;
  user_id: string;
  category_name: string;
}

interface StoreReceiptInput {
  receipt: Receipt;
  categories: Category[];
  items: Item[];
}

function bucket(p: number) {
  if (p >= 1000) return '₹1000_plus';
  if (p >= 500) return '₹500_999';
  if (p >= 100) return '₹100_499';
  return '₹0_99';
}

export async function storeReceiptData({
  receipt,
  items,
}: StoreReceiptInput): Promise<any> {
  const now = Timestamp.now();
  let result:any

  /* 1️⃣  create the receipt document */
  console.log("📦 Creating receipt document...");
  const receiptRef = await db.collection('receipts').add({
    ...receipt,
    created_at: now,
    updated_at: now,
  });
  const receiptId = receiptRef.id;
  console.log(`🧾 Receipt stored with ID: ${receiptId}`);

  /* 2️⃣  prepare embed strings for every item */
  const embedInputs = items.map(it =>
    `${it.name} | ${it.category_name} | ${bucket(it.price)} | ${receipt.merchant_name ?? ''}`
  );

  /* 3️⃣  batch-embed (taskType = RETRIEVAL_DOCUMENT) */
  console.log("🧠 Generating embeddings for items...");
  const vecs = await embed(embedInputs, { taskType: 'RETRIEVAL_DOCUMENT' }) as number[][];
  console.log("✅ Embeddings generated.");

  /* 4️⃣  write items + vectors in one batch */
  console.log("📤 Writing items with embeddings to Firestore...");
  const batch: WriteBatch = db.batch();
  items.forEach((it, idx) => {
    const docRef = db.collection('items').doc();
    batch.set(docRef, {
      ...it,
      receipt_id: receiptId,
      created_at: now,
      updated_at: now,
      embedding: FieldValue.vector(vecs[idx]),   // vecs[idx] is number[] K-NN vector
    });
  });
  await batch.commit();

  console.log('✅ Receipt and items stored with embeddings.');
}


import { Firestore } from '@google-cloud/firestore';
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from "crypto";

const firestore = new Firestore();

/**
 * Save receipt with items to Firestore under "receipts" collection
 */
export async function saveReceiptToFirestore(data: {
  userId: string;
  vendor: string;
  amount: number;
  // category: string;
  confidence: number;
  date: string;
  items: { name: string; price: number; quantity: number, category: string }[];
  notes?: string;
}): Promise<{ success: boolean; message: string, receiptId?:string, itemsInserted?:any }> {
   const PRICE_BUCKET = (p: number) =>
        p >= 1000 ? "₹1000_plus" :
            p >= 500 ? "₹500_999" :
                p >= 100 ? "₹100_499" :
                    "₹0_99";
  
   const { userId, vendor, amount, confidence, date, items, notes } = data;

  try {
       /* ── 1. save the receipt itself ───────────────────────── */
                const receiptId = randomUUID();
                const receiptRef = db.collection("receipts").doc(receiptId);
    
                await receiptRef.set({
                    // userId,
                    receiptId,
                    ...data,
                    createdAt: new Date(),
                });
    
                /* ── 2. prepare item-level embeddings ─────────────────── */
                const embedInputs =items.map(
                    it => `${it.name} | ${it.category} | ${PRICE_BUCKET(it.price)} | ${vendor} on date:${date}`
                );
    
                const vecs = await embed(embedInputs, { taskType: "RETRIEVAL_DOCUMENT" }) as number[][];
    
                /* ── 3. batch-write items into a **sub-collection** ───── */
                const batch = db.batch();
    
                data.items.forEach((it, idx) => {
                    const itemRef = receiptRef.collection("embeddings").doc();   // sub-doc
                    batch.set(itemRef, {
                        user_id: data.userId,
                        receipt_id: receiptId,
                        vendor: data.vendor,
                        purchase_date: data.date,
                        name: it.name,
                        price: it.price,
                        quantity: it.quantity,
                        // category_name: data.category,
                        embedding: vecs[idx],          // 768-D vector
                        created_at: new Date(),
                    });
                });
    
                await batch.commit();
    
                return ({
                    success: true,
                    message: "Receipt and line-items stored with embeddings",
                    receiptId,
                    itemsInserted: data.items.length,
                });
    
  } catch (error) {
    console.log("Error saving receipt to Firestore:", error);
    return {
      success: false,
      message: `Failed to save receipt: ${(error as Error).message}`,
  }
}
}