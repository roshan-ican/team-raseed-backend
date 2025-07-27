import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

import {
  RECEIPT_CATEGORIZATION_PROMPT_V2,
} from "../constants/prompts";

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(GEMINI_API_KEY, "GEEE__")

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

export async function categorize(rawText: string, userId: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  console.log(rawText, "rawText in categorize function");

  // Use the separated prompt function
  // const combinedPrompt = RECEIPT_CATEGORIZATION_PROMPT(rawText);
  const combinedPrompt = RECEIPT_CATEGORIZATION_PROMPT_V2(
    rawText,
    userId
  );

  try {
    const response = await ai.models.generateContent({
      model: process.env.MODEL || "gemini-1.5-flash",
      contents: combinedPrompt,
    });

    console.log("Categorization Response:", response.text);
    return response.text;
  } catch (error) {
    console.error("Error in categorization:", error);
    throw new Error("Failed to categorize receipt data");
  }
}
