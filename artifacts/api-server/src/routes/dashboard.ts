import { Router, type IRouter } from "express";
import {
  getVisitsPerUser,
  getTotalVisits,
  getFeedbackSummary,
  getInactiveUsersToday,
} from "../controllers/dashboardController";
import { authenticate } from "../middlewares/authenticate";
import { requireManager } from "../middlewares/requireManager";

const router: IRouter = Router();

router.use(authenticate, requireManager);

router.get("/dashboard/visits-per-user", getVisitsPerUser);
router.get("/dashboard/total-visits", getTotalVisits);
router.get("/dashboard/feedback-summary", getFeedbackSummary);
router.get("/dashboard/inactive-users", getInactiveUsersToday);

export default router;
