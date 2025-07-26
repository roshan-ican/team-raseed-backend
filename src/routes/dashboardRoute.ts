import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendNotification } from "../services/sendNotification";
import {
  DashboardParams,
  getDashboardData,
} from "../controllers/dashboard.controller";

export default async function DashBoardRoute(app: FastifyInstance) {
  app.get("/", async (req: FastifyRequest, res: FastifyReply) => {
    try {
      const {
        timeRange = "30d",
        category: selectedCategory = "all",
        userId = "",
      } = req.query as any;

      console.log(req.query);
      // const userId = req.user.id; // From authentication middleware
      // const userId = "jagrutihota92@gmail.com";

      const dashboardData = await getDashboardData(userId, {
        timeRange: timeRange as DashboardParams["timeRange"],
        selectedCategory:
          selectedCategory === "all" ? undefined : (selectedCategory as string),
      });

      res.send(dashboardData);
    } catch (error) {
      console.error("Dashboard API error:", error);
      res.status(500).send({ error: "Failed to fetch dashboard data" });
    }
  });
}
