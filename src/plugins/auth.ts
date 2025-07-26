// src/plugins/auth.ts
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { FastifyReply } from 'fastify/types/reply';
import { FastifyRequest } from 'fastify/types/request';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }

  interface FastifyRequest {
    user?: any;
  }
}


const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.cookies.token;
      if (!token) throw new Error('No token');

      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      request.user = decoded;
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(authPlugin);
