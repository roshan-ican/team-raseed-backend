// src/utils/smart-receipt-validator.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { loadCredentialsFromBucket } from '../utils/bucket-config';


interface ValidationResult {
  isValid: boolean;
  message: string;
  analysis?: {
    hasText: boolean;
    textDensity: number;
    isDocument: boolean;
    detectedObjects: string[];
    labels: string[];
  };
}

export async function validateReceiptWithSmartDetection(imageBuffer: Buffer): Promise<ValidationResult> {
  try {
    const credentials = await loadCredentialsFromBucket();
    const client = new ImageAnnotatorClient({
      credentials: credentials,
      projectId: credentials.project_id,
    });

    console.log('🔍 Analyzing image with Vision AI...');

    const imageRequest = {
      image: { content: imageBuffer.toString('base64') }
    };

    // Perform multiple detection types in parallel
    const [
      textResult,
      labelResult,
      objectResult,
      documentResult
    ] = await Promise.all([
      // Text detection - check if there's readable text
      client.textDetection(imageRequest),
      
      // Label detection - identify what type of image this is
      client.labelDetection(imageRequest),
      
      // Object detection - detect specific objects (check if method exists)
      client.objectLocalization ? client.objectLocalization(imageRequest) : Promise.resolve([{ localizedObjectAnnotations: [] }]),
      
      // Document text detection - specifically for documents/receipts
      client.documentTextDetection(imageRequest)
    ]);

    return analyzeImageFeatures({
      textDetections: textResult[0]?.textAnnotations || [],
      labels: labelResult[0]?.labelAnnotations || [],
      objects: objectResult[0]?.localizedObjectAnnotations || [],
      documentText: documentResult[0]?.fullTextAnnotation || null
    });

  } catch (error) {
    console.error('❌ Vision API error:', error);
    return {
      isValid: false,
      message: 'Sorry, we could not process your image. Please try uploading a clear photo of your receipt.'
    };
  }
}

function analyzeImageFeatures(features: {
  textDetections: any[];
  labels: any[];
  objects: any[];
  documentText: any;
}): ValidationResult {
  const analysis = {
    hasText: false,
    textDensity: 0,
    isDocument: false,
    detectedObjects: [] as string[],
    labels: [] as string[]
  };

  // Analyze text content
  if (features.textDetections && features.textDetections.length > 0) {
    analysis.hasText = true;
    const fullText = features.textDetections[0]?.description || '';
    
    // Calculate text density (words per character - higher = more structured)
    const words = fullText.split(/\s+/).filter((word: string | any[]) => word.length > 0);
    analysis.textDensity = words.length / Math.max(fullText.length, 1) * 100;
    
    console.log(`📝 Text found: ${words.length} words, density: ${analysis.textDensity.toFixed(2)}%`);
  }

  // Analyze labels to understand image content
  const documentLabels = ['Text', 'Document', 'Receipt', 'Paper', 'Font', 'Invoice', 'Bill'];
  const nonDocumentLabels = ['Person', 'Face', 'Animal', 'Car', 'Building', 'Nature', 'Food', 'Clothing', 'Toy', 'Art'];
  
  let documentScore = 0;
  let nonDocumentScore = 0;

  features.labels.forEach((label: any) => {
    const labelName = label.description;
    const confidence = label.score;
    analysis.labels.push(labelName);
    
    console.log(`🏷️ Label: ${labelName} (${(confidence * 100).toFixed(1)}%)`);
    
    if (documentLabels.some(docLabel => labelName.toLowerCase().includes(docLabel.toLowerCase()))) {
      documentScore += confidence;
    }
    
    if (nonDocumentLabels.some(nonDocLabel => labelName.toLowerCase().includes(nonDocLabel.toLowerCase()))) {
      nonDocumentScore += confidence;
    }
  });

  // Analyze detected objects
  features.objects.forEach((object: any) => {
    const objectName = object.name;
    analysis.detectedObjects.push(objectName);
    console.log(`🎯 Object detected: ${objectName}`);
    
    // If we detect people, animals, vehicles, etc., it's probably not a receipt
    const nonReceiptObjects = ['Person', 'Animal', 'Car', 'Vehicle', 'Face', 'Clothing'];
    if (nonReceiptObjects.some(obj => objectName.toLowerCase().includes(obj.toLowerCase()))) {
      nonDocumentScore += 0.5;
    }
  });

  // Check document structure
  if (features.documentText && features.documentText.pages) {
    analysis.isDocument = true;
    console.log('📄 Document structure detected');
    documentScore += 0.3;
  }

  // Decision logic based on multiple factors
  console.log(`📊 Document score: ${documentScore.toFixed(2)}, Non-document score: ${nonDocumentScore.toFixed(2)}`);

  // No text detected at all
  if (!analysis.hasText) {
    return {
      isValid: false,
      message: 'No text detected in the image. Please upload a photo of your receipt with visible text.',
      analysis
    };
  }

  // Very little text (likely not a receipt)
  if (analysis.textDensity < 2) {
    return {
      isValid: false,
      message: 'This image doesn\'t contain enough text to be a receipt. Please upload a clear photo of your receipt.',
      analysis
    };
  }

  // Strong indicators it's NOT a document/receipt
  if (nonDocumentScore > documentScore + 0.3) {
    const detectedTypes = analysis.labels.slice(0, 3).join(', ');
    return {
      isValid: false,
      message: `This appears to be an image of ${detectedTypes.toLowerCase()}, not a receipt. Please upload a photo of your purchase receipt.`,
      analysis
    };
  }

  // Strong indicators it IS a document/receipt
  if (documentScore > 0.5 || analysis.isDocument) {
    return {
      isValid: true,
      message: 'Receipt validated successfully!',
      analysis
    };
  }

  // Moderate text density but unclear type
  if (analysis.textDensity > 5) {
    return {
      isValid: true,
      message: 'Image appears to contain receipt-like content.',
      analysis
    };
  }

  // Default case - not confident either way
  return {
    isValid: false,
    message: 'Unable to clearly identify this as a receipt. Please upload a clear photo of your purchase receipt with visible text and prices.',
    analysis
  };
}

// Quick pre-validation for file format
export function validateImageFile(buffer: Buffer): ValidationResult {
  const fileSizeKB = buffer.length / 1024;
  
  if (fileSizeKB < 5) {
    return {
      isValid: false,
      message: 'Image file is too small. Please upload a clear photo.'
    };
  }
  
  if (fileSizeKB > 10000) {
    return {
      isValid: false,
      message: 'Image file is too large. Please compress and try again.'
    };
  }

  // Check if it's actually an image
  const imageHeaders = [
    [0xFF, 0xD8], // JPEG
    [0x89, 0x50, 0x4E, 0x47], // PNG
    [0x47, 0x49, 0x46], // GIF
    [0x52, 0x49, 0x46, 0x46], // WebP
  ];

  const header = Array.from(buffer.slice(0, 4));
  const isValidImage = imageHeaders.some(validHeader => 
    validHeader.every((byte, index) => header[index] === byte)
  );

  if (!isValidImage) {
    return {
      isValid: false,
      message: 'Please upload a valid image file.'
    };
  }

  return {
    isValid: true,
    message: 'File format is valid.'
  };
}