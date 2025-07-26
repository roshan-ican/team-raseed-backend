import { FastifyInstance } from "fastify";

// import categorizeRoute from "../utils/categorizeRoute";
import extractRoutes from "./extractRoute";
import vertexRoutes from "./vertexRoutes";
import userPromptRoute from "./userPromptRoute";
import authRoutes from "./authRoute";
import DashBoardRoute from "./dashboardRoute";
import saveReceipts from "./saveReceipt";
 import getReceiptRoute from "./getReceiptRoute";
import addManulReceiptRoute from "./addManualReceiptRoute";

export default async function mainRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/api" });
  app.register(vertexRoutes, { prefix: "/api" });
  // app.register(categorizeRoute, { prefix: "/api" });
  app.register(extractRoutes, { prefix: "/api" });
  app.register(userPromptRoute, { prefix: "/api" });
  app.register(DashBoardRoute, { prefix: "/api/dashboard" });
  app.register(saveReceipts, { prefix: "/api" });
  app.register(getReceiptRoute, { prefix: "/api" });
  app.register(addManulReceiptRoute,{prefix:'/api'})
}
