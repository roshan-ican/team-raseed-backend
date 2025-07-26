// utils/jsonExtractor.ts
export function extractJsonFromResponse(response: string): any {
  try {
    // Method 1: Try to extract from markdown code block
    const codeBlockMatch = response.match(/```(?:json)?\s*(.*?)\s*```/s);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    
    // Method 2: Try to extract JSON object directly
    const objectMatch = response.match(/(\{.*\})/s);
    if (objectMatch) {
      return JSON.parse(objectMatch[1]);
    }
    
    // Method 3: Try parsing the entire response
    return JSON.parse(response);
    
  } catch (error) {
    console.error('All JSON extraction methods failed:', error);
    return null;
  }
}
// utils/extractJson.ts