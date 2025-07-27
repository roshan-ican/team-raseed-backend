import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Initialize the client outside the function or as a singleton
const client = new DocumentProcessorServiceClient();

// Helper function to calculate confidence
function calculateOverallConfidence(entities: any[]): number {
  if (!entities || entities.length === 0) return 0;
  
  const confidenceSum = entities.reduce((sum, entity) => {
    return sum + (entity.confidence || 0);
  }, 0);
  
  return confidenceSum / entities.length;
}

export async function extractReceiptData(
  buffer: Buffer, 
  filename: string = 'receipt'
): Promise<any> {
  try {
    // Validate environment variables
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us';
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    if (!projectId || !processorId) {
      throw new Error('Missing required environment variables: GOOGLE_CLOUD_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID');
    }
    
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
    
    // Make sure client is properly initialized
    if (!client) {
      throw new Error('Document AI client is not initialized');
    }
    
    const [result] = await client.processDocument(request);
    const { document } = result;
    
    return {
      rawText: document?.text || '',
      entities: document?.entities || [],
      confidence: calculateOverallConfidence(document?.entities || []),
    };
    
  } catch (error: any) {
    console.error('Document AI processing error:', error);
    throw new Error(`Document AI processing failed: ${error?.message}`);
  }
}

// Alternative: Initialize client within the function if you prefer
export async function extractReceiptDataAlternative(
  buffer: Buffer, 
  filename: string = 'receipt'
): Promise<any> {
  try {
    // Initialize client inside the function
    const client = new DocumentProcessorServiceClient();
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us';
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    if (!projectId || !processorId) {
      throw new Error('Missing required environment variables');
    }
    
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
    
  } catch (error: any) {
    console.error('Document AI processing error:', error);
    throw new Error(`Document AI processing failed: ${error?.message}`);
  }
}