// src/config/documentAIClient.ts
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// ✅ Much simpler approach
const client = new DocumentProcessorServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE, // Direct path to Google Cloud service account
});

export { client };
export default client;
