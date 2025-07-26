import Fastify from "fastify";
import mainRoutes from "./routes";
import authPlugin from "./plugins/auth";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import NotificationRoutes from "./routes/notificationRoutes";
const app = Fastify({ logger: true });

app.register(authPlugin);

app.get("/", async () => {
  return { status: "ok" };
});

app.register(cookie, {
  secret: process.env.COOKIE_SECRET || "your-super-secret",
  hook: "onRequest",
});

app.register(cors, {
  origin: "http://localhost:3000",
  credentials: true,
});

app.register(require("@fastify/swagger"), {
  exposeRoute: true,
  routePrefix: "/docs",
  swagger: { info: { title: "API", version: "1.0.0" } },
});

app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
app.register(NotificationRoutes, {
  prefix: "/api/v1/notification",
});

// main()

app.register(mainRoutes);

export default app;
