import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';

dotenv.config();


const vertexAI = new VertexAI({
  project: process.env.PROJECT_ID,
  location: process.env.LOCATION
});

const model = `${process.env.MODEL}`

const generativeModel = vertexAI.preview.getGenerativeModel({
  model,
  generationConfig: {
    maxOutputTokens: 100,
    temperature: 0.9,
    topP: 1,
  },
});

const productsData = {
    "products": {
      "Rice": 2.99,
      "Pasta": 1.49,
      "Cereal": 3.99,
      "T-Shirt": 12.99,
      "Jeans": 29.99,
      "Carrot": 0.99,
      "Tomato": 1.49,
      "Apple": 1.20,
      "Banana": 0.79,
      "Wireless Earbuds": 59.99
    }
  };
  
  // Convert the products data to a JSON string for embedding in the prompt
  const productsJsonString = JSON.stringify(productsData, null, 2);
  
  // Construct the full prompt string
  const fullPrompt = `You are an expert product categorizer. Your task is to accurately assign a category to each product based on its name.
  
  Here is the list of products with their prices:
  ${productsJsonString}
  
  Here are the categories you must use. Do not use any other categories:
  - Groceries
  - Clothing
  - Electronics
  - Other (use only if a product genuinely doesn't fit any of the above)
  
  For each product, output the product name and its assigned category in a clear, structured JSON format. Ensure all products from the input list are included in the output.
  
  Example of desired output format:
  \`\`\`json
  {
    "categorized_products": [
      {
        "product_name": "Product A",
        "category": "Category X"
      },
      {
        "product_name": "Product B",
        "category": "Category Y"
      }
    ]
  }
  \`\`\`
  Now, categorize the provided products.`;
  
  // The `contents` array for the API request
  const promptObject = {
    contents: [
      {
        role: 'user', // The role of the speaker (in this case, the user/you)
        parts: [
          {
            text: fullPrompt, // The actual text of your prompt
          },
        ],
      },
    ],
  };

export const streamVertexContent = async (prompt: string, write: (chunk: string) => void) => {
  try {
    const promptObject = {
        contents: [
          {
            role: 'user', 
            parts: [
              {
                text: prompt, 
              },
            ],
          },
        ],
      };
    
      const response = await generativeModel.generateContentStream(promptObject);
      console.log(response, 'response');
    
      for await (const item of response.stream) {
        const chunk = item?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        write(chunk);
      }
  } catch (error) {
    console.log(error, 'error');    
    
  }
};
