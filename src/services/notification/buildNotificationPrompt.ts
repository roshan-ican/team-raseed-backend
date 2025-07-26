import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { genAI } from "../userPrompt";
import { sendNotification } from "../sendNotification";

interface ReciptType {
  vendor: string;
  date: string;
  amount: number;
  items: {
    name: string;
    price: number;
    quantity?: number;
    category: string;
  }[];
  notes: string;
  confidence: number;
}

function cleanAiJsonResponse(s: string) {
  return s
    .replace(/^```json[\r\n]*/i, "")
    .replace(/^```[\r\n]*/i, "")
    .replace(/```[\r\n]*$/g, "")
    .trim();
}

function truncateAfterFirstJsonBlock(s: string) {
  const end = s.lastIndexOf("}");
  return end !== -1 ? s.slice(0, end + 1) : s;
}

function buildNotificationPrompt(
  token: string,
  receipts: ReciptType[]
): string {
  const formattedReceipts = receipts
    .map((receipt, i) => {
      const items = receipt.items
        .map(
          (item) =>
            `- ${item.name} (${item.category}) — ₹${item.price}${
              item.quantity ? ` x${item.quantity}` : ""
            }`
        )
        .join("\n");

      return `Receipt #${i + 1}:
Vendor: ${receipt.vendor}
Date: ${receipt.date}
Amount: ₹${receipt.amount}
Items:\n${items}
Notes: ${receipt.notes || "None"}
`;
    })
    .join("\n---\n");

  const prompt = `
You are an AI assistant that generates financial insights and tips from receipts.

Given the following receipt data for a user from yesterday:

${formattedReceipts}

Generate a personalized daily notification as JSON **strictly in the following format**:

{
  "token": "${token}",
  "title": "short one-line summary of the day (max 12 words)",
  "body": "friendly recommendation or insight based on the receipts"
}

✅ Rules:
- Do not include explanation or markdown.
- Return only a **valid JSON object**.
- Title should be short and catchy.
- Body should be friendly, actionable, and insightful.
- Never mention receipt numbers or internal formatting.

Now, generate the output.
`.trim();

  return prompt;
}

export { buildNotificationPrompt };

export async function sendDailyGeminiNotification(userId: string) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error(`User ${userId} not found`);
  }

  const user = userSnap.data();
  const token = user.deviceTokens?.[0];

  if (!token) {
    throw new Error(`No device token found for user ${userId}`);
  }

  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  const receiptsRef = collection(db, "receipts");
  const receiptsQuery = query(
    receiptsRef,
    where("userId", "==", userId),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
  );

  const receiptSnap = await getDocs(receiptsQuery);
  const receipts = receiptSnap.docs.map((doc) => doc.data());

  if (receipts.length === 0) {
    console.log(`No receipts found for ${userId} on ${start.toDateString()}`);
    return;
  }
  const modelName = process.env.MODEL;
  if (!modelName) {
    throw new Error("MODEL environment variable is not set");
  }
  const model = genAI.getGenerativeModel({ model: modelName });
  const prompt = buildNotificationPrompt(
    "ek6SVXmsPGSXpEBniRpYpb:APA91bHNHmv4VmBgaQcZMLW9cF133CLKI1F7RJIoGlpVuIqkBtYOfCZVbIR58007mopqwUGwnHta3O_zmqvDqdadH2-0z13ect7ozbY0Gm3NuHctSK8u0ic",
    receipts as ReciptType[]
  );
  const result = await model.generateContent([prompt]);
  const response = result.response.text();

  let cleaned;
  try {
    cleaned = truncateAfterFirstJsonBlock(cleanAiJsonResponse(response));
    const notification = JSON.parse(cleaned);
    console.log("response", notification?.token);
    const data = await sendNotification(notification);
    return data;
  } catch (err) {
    console.error("Invalid Gemini JSON response:", response);
    return err;
  }
}
