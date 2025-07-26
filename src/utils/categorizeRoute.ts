import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { categorize } from "../services/categorize";

// export default async function categorizeRoute(app: FastifyInstance) {


//     app.post('/categorize', async (request: FastifyRequest<{ Body: { prompt: string } }>, reply: FastifyReply) => {
//         const prompt = 'todays date'

//         if (!prompt) {
//             return reply.status(400).send({ error: 'Prompt is required' });
//         }

//         try {
//             //   reply.raw.setHeader('Content-Type', 'text/plain');

//             const res = await categorize(prompt);
//             console.log(res)
//             reply.send(res);

//             reply.raw.end();
//         } catch (error) {
//             console.error('Error generating with Vertex AI:', error);
//             reply.status(500).send({ error: 'Failed to generate content' });
//         }
//     });

// }