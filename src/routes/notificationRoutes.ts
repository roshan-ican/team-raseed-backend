import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendNotification } from "../services/sendNotification";
import { sendDailyGeminiNotification } from "../services/notification/buildNotificationPrompt";

export default async function NotificationRoutes(app: FastifyInstance) {
  app.post("/send-push", async (request, reply) => {
    const { token, title, body } = request.body as any;

    const data = await sendNotification({ token, title, body });
    reply.send(data);
  });

  app.get(
    "/send-push",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await sendDailyGeminiNotification("mohdmubbashir71@gmail.com");
      // reply.send({ message: "Notification route is working" });
    }
  );
}
