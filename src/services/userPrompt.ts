import { SpeechClient } from "@google-cloud/speech";
import { google } from "@google-cloud/speech/build/protos/protos";
import { embed } from "../lib/embed-vertex";
import { streamlinedRAGQuery } from "./indUserQuery";
import { generateFireStoreQuery } from "./buildGeminiQuery";



async function createQueryEmbedding(text: string): Promise<number[]> {
  try {
    // Use your existing embed function with RETRIEVAL_QUERY task type
    const embedding = await embed(text, {
      taskType: "RETRIEVAL_QUERY", // Important: Use QUERY for search queries
      dimensions: 768, // Match the dimensions of your stored embeddings
      normalize: true, // Keep normalization consistent
    });

    // Since embed can return number[] | number[][], ensure we get number[]
    return Array.isArray(embedding[0]) ? embedding[0] : (embedding as number[]);
  } catch (error) {
    console.error("Error creating query embedding:", error);
    throw error;
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai";



const speechClient = new SpeechClient();


export const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY as string
);
export const allModel = genAI.getGenerativeModel({
  model: process.env.MODEL as string,
});



export const transcribeInput = async (
  params: { audioContent?: string; textContent?: string },
  userId: string, 
  includeInsights: boolean = true
): Promise<any> => {
  const { audioContent, textContent } = params;
  //--------------------------------------------------------------------
  // 1. Get the transcription
  //--------------------------------------------------------------------
  let transcription = "";

  if (audioContent) {
    try {
      const [sttResponse] = await speechClient.recognize({
        audio: { content: audioContent },
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US",
        },
      });

      transcription =
        sttResponse.results
          ?.map(
            (r: google.cloud.speech.v1.ISpeechRecognitionResult) =>
              r.alternatives?.[0]?.transcript ?? ""
          )
          .join("\n")
          .trim() ?? "";

      if (!transcription) {
        return {
          status: false,
          transcription: "",
          error: "No speech detected in audio",
        };
      }
    } catch (e) {
      console.error("Speech-to-text error:", e);
      return {
        status: false,
        transcription: "",
        error: `Speech recognition failed: ${(e as Error).message}`,
      };
    }
    /* ---------- TEXT PATH ---------- */
  } else if (textContent) {
    transcription = textContent.trim();
    if (!transcription) {
      return { transcription: "", error: "Empty textContent provided" };
    }
  } else {
    return {
      transcription: "",
      error: "Neither audioContent nor textContent supplied",
    };
  }

  /* ------------ SUCCESS OF TRANSCRIPTION -------------*/
  console.log("✅ Transcription complete:", transcription);
  return {
    status: true,
    transcription,
    error: "",
  };
};

/**
 * Accepts EITHER `audioContent` (base-64 WebM/OPUS) OR `textContent` (plain UTF-8).
 * If both are provided, `audioContent` wins.
 */
export const userPrompts = async (
  transcription: string,
  userId: string,
): Promise<any> => {
  console.log("Query text:", transcription);
  //--------------------------------------------------------------------
  // 1.  Get/create chatcache
  //--------------------------------------------------------------------

  //--------------------------------------------------------------------
  // 2. Run the Firestore / receipts query with fallback
  //--------------------------------------------------------------------

  try {
    // try {
    //   console.log("🚀 Using optimized vector search");
    //   const fallbackResult = await generateFireStoreQuery(transcription, userId);
    //   return fallbackResult;

    // } catch (optErr: any) {
    //   console.warn(
    //     "⚠️ Optimized search failed, falling back to original:",
    //     optErr.message
    //   );
    // }
    let optimizedResult;
    if (typeof createQueryEmbedding === "function") {
      try {
        optimizedResult = await streamlinedRAGQuery(
          transcription,
          userId,
          createQueryEmbedding
        );
        console.log("Result from streamlinedRAGQuery:", optimizedResult);
        console.log("optimizedResult.success:", optimizedResult.success);
      } catch (optErr: any) {
        console.error("Error during streamlinedRAGQuery:", optErr);
        // If an error occurs, explicitly set optimizedResult to indicate failure
        optimizedResult = { success: false, error: optErr.message };
      }

      if (!optimizedResult.success) {
        console.log(
          "Streamlined RAG query failed, falling back to Firestore."
        );
        optimizedResult = await generateFireStoreQuery(transcription, userId);
      }

      console.log(optimizedResult, "____result___");
      return optimizedResult;
    }
  } catch (queryErr: any) {
    console.error("Receipt query error:", queryErr);
    return {
      transcription,
      error: `Receipt query failed: ${queryErr.message}`,
    };
  }
}

