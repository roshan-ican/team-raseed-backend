// src/constants/prompts.ts

// src/constants/prompts.ts

export const RECEIPT_CATEGORIZATION_PROMPT = (
  rawText: string
) => `You are an expert product categorizer. Your task is to accurately assign a category to each product based on its name and then group the products by their assigned categories.

Here is the extracted receipt data to analyze and categorize:

\`\`\`
${JSON.stringify(rawText, null, 2)}
\`\`\`

Please analyze this receipt text, identify the products and their prices/rates, then categorize them into appropriate groups (such as Food & Beverages, Personal Care, Household Items, Electronics, Clothing, etc.). Return the result in a structured JSON format showing:
1. Each category with its products
2. Product names in original language with English translation in parentheses
3. Total number of items per category
4. Only take items whose prices, rates, and quantities are greater than 0.00

Return the response in this JSON structure:
\`\`\`json
{
  "categories": {
    "Food & Beverages": [
      {
        "item": "முள்ளங்கி (Radish)",
        "price": 25.00,
        "rate": 25.00,
        "quantity": 1,
        "total": 25.00
      }
    ],
    "Personal Care": [...],
    "Household Items": [...]
  },
  "summary": {
    "total_categories": 0,
    "total_items": 0,
    "total_amount": 0.00
  }
}
\`\`\`

Important formatting rules:
- Keep the original language text FIRST
- Add English translation in parentheses: "Original Text (English Translation)"
- For Tamil: "தக்காளி (Tomato)"
- For Hindi: "टमाटर (Tomato)"
- For Kannada: "ಟೊಮೇಟೊ (Tomato)"
- For Telugu: "టమాట (Tomato)"
- For English items: Keep as is, no parentheses needed
- For mixed language: "Apple ஆப்பிள் (Apple)"

IMPORTANT: Return ONLY the JSON structure above. No additional text or explanations.`;

export const RECEIPT_CATEGORIZATION_PROMPT_V2 = (
  rawText: string,
  userId: string
) => `You are an expert product categorizer. Your task is to analyze a receipt and generate a structured Firestore-compatible JSON for storing user receipt data.


Here is the extracted receipt data to analyze and categorize:

\`\`\`
${JSON.stringify(rawText, null, 2)}
\`\`\`

Please analyze this receipt text, extract all items with valid price, rate, and quantity (> 0.00), categorize them accurately (only take below category), and return a structured JSON response suitable for Firestore.


[
“Groceries & Pantry”
“Beverages”
“Personal Care & Beauty”
“Health & Wellness”
“Home & Cleaning Supplies”
“Baby Kids & Maternity”
“Fashion & Accessories”
“Electronics & Gadgets”
“Home & Kitchen Appliances”
“Pets Garden & Auto”
“Miscellaneous & Extras”
]
Use the following Firestore collections:

\`\`\`json
{
  "receipt": {
    "user_id": "${userId}",
    "name": "Receipt #123",  // can be inferred or use a placeholder
    "total_price": 123.45,
    "total_items": 5,
    "merchant_name": "Swiggy",  // optional if parsed
    "currency": "INR",
    "receipt_date": "2025-07-23"  // if parsable
    "tax": 0.0,
    "subtotal": 0.0
  },

  "items": [
    {
      "name": "தக்காளி (Tomato)",
      "price": 25.00,
      "rate": 25.00,
      "quantity": 1,
      "receipt_id": "receipt document ID",
      "user_id": "${userId}",
      "category_name": "Groceries & Pantry"
    }
  ]
}
\`\`\`

### Notes:
- Group items under categories using their \`name\`.
- Use the provided user ID: \`${userId}\` consistently.
- For each item:
  - Use original language first.
  - Add English translation in parentheses:
    - Tamil: "தக்காளி (Tomato)"
    - Hindi: "टमाटर (Tomato)"
    - Kannada: "ಟೊಮೇಟೊ (Tomato)"
    - Telugu: "టమాట (Tomato)"
    - Mixed: "Apple ஆப்பிள் (Apple)"
- Skip any item with missing or 0.00 values for price, rate, or quantity.
- For each \`item\`, set \`receipt_id\` as the generated receipt document ID (you'll link it during Firestore insertion).

### IMPORTANT: Return only the JSON structure above. No extra text or explanations.
`;

// // Template version with Telugu support
// export const CATEGORIZATION_TEMPLATE = `You are an expert product categorizer. Your task is to accurately assign a category to each product based on its name and then group the products by their assigned categories.

// Here is the extracted receipt data to analyze and categorize:

// \`\`\`
// {RECEIPT_DATA}
// \`\`\`

// Please analyze this receipt text, identify the products and their prices/rates, then categorize them into appropriate groups (such as Food & Beverages, Personal Care, Household Items, Electronics, Clothing, etc.). Return the result in a structured JSON format showing:
// 1. Each category with its products
// 2. Product names in original language with English translation in parentheses
// 3. Total number of items per category
// 4. Only take items whose prices, rates, and quantities are greater than 0.00

// Return the response in this JSON structure:
// \`\`\`json
// {
//   "categories": {
//     "Food & Beverages": [
//       {
//         "item": "Original Language (English Translation)",
//         "price": 0.00,
//         "rate": 0.00,
//         "quantity": 1,
//         "total": 0.00
//       }
//     ],
//     "Personal Care": [...],
//     "Household Items": [...]
//   },
//   "summary": {
//     "total_categories": 0,
//     "total_items": 0
//   }
// }
// \`\`\`

// Important formatting rules:
// - Keep the original language text FIRST
// - Add English translation in parentheses: "Original Text (English Translation)"
// - For Tamil: "தக்காளி (Tomato)"
// - For Hindi: "टमाटर (Tomato)"
// - For Kannada: "ಟೊಮೇಟೊ (Tomato)"
// - For Telugu: "టమాట (Tomato)"
// - For English items: Keep as is, no parentheses needed
// - For mixed language: Use both scripts with translation

// IMPORTANT: Return ONLY the JSON structure above. No additional text or explanations.`;

// Function to build prompt with template
// export const buildCategorizationPrompt = (rawText: string): string => {
//   return CATEGORIZATION_TEMPLATE.replace("{RECEIPT_DATA}", rawText);
// };


