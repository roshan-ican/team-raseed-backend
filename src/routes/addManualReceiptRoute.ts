import { FastifyInstance } from "fastify";
import { categorize } from "../services/categorize";
import { extractJsonFromResponse } from "../utils/extractJson";

export default async function addManulReceiptRoute(app: FastifyInstance) {
    app.post('/add_manual_receipt', async (request:any, reply) => {
      try {
      console.log('request.body', request.body)
      const categorizedData=await categorize( JSON.stringify(request.body.data.items),request.body.userId)
      console.log(categorizedData,'categorizedData')
      let parsedData = extractJsonFromResponse(categorizedData as string) || {
                receipt: {},
                categories: {},
                items: {},
              };
      
              console.log(parsedData, "__parsed_Data")

              const responseData = {
                success: true,
                categorization: parsedData,
                // documentId,
                processingStatus: "processed" as const,
              };
              console.log(responseData, "__respine dae")
              reply.send(responseData);
  
      } catch (err) {
        request.log.error(err);
        reply.status(500).send({ error: 'Failed to fetch receipts' });
      }
    });
  

  }