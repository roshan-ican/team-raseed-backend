// src/utils/simpleDocumentAI.ts

import client from "../config/documentAiClient";


export async function extractReceiptData(
  buffer: Buffer, 
  filename: string = 'receipt'
): Promise<any> {
  try {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us';
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const mimeType = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    
    const request = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType,
      },
    };

    console.log('Processing receipt with Document AI...');
    
    const [result] = await client.processDocument(request);
    const { document } = result;
    
    return {
      rawText: document?.text || '',
      entities: document?.entities || [],
      confidence: calculateOverallConfidence(document?.entities || []),
    };
    
  } catch (error:any) {
    console.error('Document AI processing error:', error);
    throw new Error(`Document AI processing failed: ${error?.message}`);
  }
}

function calculateOverallConfidence(entities: any[]): number {
  if (entities.length === 0) return 0;
  const totalConfidence = entities.reduce((sum, entity) => sum + (entity.confidence || 0), 0);
  return totalConfidence / entities.length;
}
