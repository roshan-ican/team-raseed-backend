import { FastifyInstance } from "fastify";
import { cleanUndefinedValues } from "../middleware/categorizeAndSave";
import { randomUUID } from "crypto";
import { db } from "../lib/firebase-admin"; // Firebase Admin SDK
import { diagnosticCreateReceiptPass } from "../services/googleWallet";
import { embed } from "../lib/embed-vertex";
import { Timestamp } from "firebase-admin/firestore";

export default function saveReceipts(app: FastifyInstance) {
  const PRICE_BUCKET = (p: number) =>
    p >= 1000
      ? "₹1000_plus"
      : p >= 500
      ? "₹500_999"
      : p >= 100
      ? "₹100_499"
      : "₹0_99";

  app.post("/save-receipt", async (req, reply) => {
    const { userId, editedCategorization } = req.body as {
      userId: string;
      editedCategorization: {
        vendor: string;
        date: string;
        amount: number;
        taxAmount?: number;
        category: string;
        items: { name: string; price: number; quantity: number }[];
        notes?: string;
        confidence?: number;
      };
    };

    if (!userId || !editedCategorization) {
      return reply
        .status(400)
        .send({ error: "Missing userId or categorization" });
    }

    try {
      const cleanedData = cleanUndefinedValues(editedCategorization);
      const receiptId = randomUUID();

      const dateObj = new Date(editedCategorization.date);
      const timestampedDate = Timestamp.fromDate(dateObj);
      const now = Timestamp.now();

      const receiptRef = db.collection("receipts").doc(receiptId);
      await receiptRef.set({
        userId,
        receiptId,
        vendor: editedCategorization.vendor,
        date: timestampedDate,
        amount: editedCategorization.amount,
        taxAmount: editedCategorization.taxAmount,
        category_name: editedCategorization.category,
        items: editedCategorization.items,
        notes: editedCategorization.notes || "",
        confidence: editedCategorization.confidence ?? 1,
        created_at: now,
        updated_at: now,
      });

      const embedInputs = editedCategorization.items.map(
        (it) =>
          `${it.name} | ${editedCategorization.category} | ${PRICE_BUCKET(
            it.price
          )} | ${editedCategorization.vendor}`
      );

      const vecs = (await embed(embedInputs, {
        taskType: "RETRIEVAL_DOCUMENT",
      })) as number[][];

      const batch = db.batch();
      editedCategorization.items.forEach((it, idx) => {
        const itemData = {
          user_id: userId,
          receipt_id: receiptId,
          vendor: editedCategorization.vendor,
          purchase_date: timestampedDate,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          category_name: editedCategorization.category,
          embedding: vecs[idx],
          created_at: now,
          updated_at: now,
        };

        const itemRef = receiptRef.collection("embeddings").doc();
        batch.set(itemRef, itemData);
      });

      await batch.commit();

      const dataOnPass = {
        receiptId,
        amount: cleanedData.amount,
        taxAmount: cleanedData.taxAmount,
        totalItems: cleanedData.items.length,
        date: editedCategorization.date,
        vendor: editedCategorization.vendor,
      };

      const url = await diagnosticCreateReceiptPass(dataOnPass);

      return reply.send({
        success: true,
        message: "Receipt and line-items stored with embeddings",
        receiptId,
        passUrl: url,
        itemsInserted: editedCategorization.items.length,
      });
    } catch (err: any) {
      req.log.error(err, "Failed to save receipt");
      return reply
        .status(500)
        .send({ error: "Failed to save receipt", details: err.message });
    }
  });
}

export const now = Timestamp.now();