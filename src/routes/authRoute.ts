// src/routes/authRoutes.ts
import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { upsertUser } from '../services/userServices';
import '@fastify/cookie';

const client = new OAuth2Client();

export default async function authRoutes(app: FastifyInstance) {
    app.post('/google', async (request, reply) => {
        const { credential, deviceTokens } = request.body as {
            credential: string;
            deviceTokens: Array<string>;
        };

        if (!credential)
            return reply.status(400).send({ error: 'Missing credential' });

        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID!,
            });

            const payload = ticket.getPayload();
            if (!payload?.email) throw new Error('No email in Google payload');

            const { email, name, picture } = payload;
            await upsertUser({ email, name, deviceTokens });

            const token = jwt.sign({ email }, process.env.JWT_SECRET!, {
                expiresIn: '1h',
            });

            reply.setCookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60, // 1 hour
            });


            return reply.send({
                message: 'Login success',
                user: { email, name, image: picture },
            });
        } catch (err) {
            request.log.error(err);
            return reply.status(401).send({ error: 'Authentication failed' });
        }
    });

    // ⛔️ Protected route
    app.get('/protected', { preHandler: app.authenticate }, async (request, reply) => {
        return { message: 'You are authorized', user: request.user };
    });



    app.post('/logout', async (request, reply) => {
        reply.clearCookie('token', {
            path: '/', // must match setCookie
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });

        return reply.send({ message: 'Logged out successfully' });
    });

}
