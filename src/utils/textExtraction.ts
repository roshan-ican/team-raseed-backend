import visionClient from '../config/visionClient';

export interface SimplifiedReceipt {
    rawText: string;
    items?: any[];
    total?: number;
}

export async function extractReceiptDataFromBuffer(buffer: Buffer): Promise<string | SimplifiedReceipt> {
    try {
        const [result] = await visionClient.textDetection({
            image: { content: buffer }
        });

        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            throw new Error('No text found in image.');
        }

        const rawText = detections[0].description || '';

        return {
            rawText,
            // Optional: add basic total extraction if needed
            total: extractBasicTotal(rawText)
        };

    } catch (error) {
        console.error('Vision API error:', error);
        throw new Error('Failed to extract text from image');
    }
}

// Optional: Simple total extraction
function extractBasicTotal(text: string): number | undefined {
    const totalMatch = text.match(/(?:total|amount|bill)\s*[:\s]*(\d+\.?\d*)/i);
    return totalMatch ? parseFloat(totalMatch[1]) : undefined;
}
