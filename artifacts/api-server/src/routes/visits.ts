import { Router, type IRouter } from "express";
import { createVisit, listVisits } from "../controllers/visitController";
import { getMyStats } from "../controllers/dashboardController";
import { authenticate } from "../middlewares/authenticate";
import { requireAgent } from "../middlewares/requireAgent";

const router: IRouter = Router();

router.use("/visits", authenticate);
router.get("/visits/my-stats", getMyStats);
router.route("/visits").get(listVisits).post(requireAgent, createVisit);

export default router;
