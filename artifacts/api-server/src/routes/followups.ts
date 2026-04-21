import { Router, type IRouter } from "express";
import {
  addFollowup,
  getPendingFollowups,
  getOverdueFollowups,
} from "../controllers/followupController";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.use(authenticate);

router.post("/add-followup", addFollowup);
router.get("/pending-followups", getPendingFollowups);
router.get("/overdue-followups", getOverdueFollowups);

export default router;
