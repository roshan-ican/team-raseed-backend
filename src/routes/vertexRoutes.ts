import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { streamVertexContent } from '../services/raseedAgent';

export default async function vertexRoutes(app: FastifyInstance) {
  app.post('/vertex', async (request: FastifyRequest<{ Body: { prompt: string } }>, reply: FastifyReply) => {
    const { prompt } = request.body;

    if (!prompt) {
      return reply.status(400).send({ error: 'Prompt is required' });
    }

    try {
      reply.raw.setHeader('Content-Type', 'text/plain');

      await streamVertexContent(prompt, (chunk) => {
        reply.raw.write(chunk);
      });

      reply.raw.end();
    } catch (error) {
      console.error('Error generating with Vertex AI:', error);
      reply.status(500).send({ error: 'Failed to generate content' });
    }
  });
}
