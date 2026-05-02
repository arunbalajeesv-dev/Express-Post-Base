import { Router, type IRouter } from "express";
import {
  addFollowup,
  getAllFollowups,
  getPendingFollowups,
  getOverdueFollowups,
  updateFollowupStatus,
  getFollowupActivity,
} from "../controllers/followupController";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.use(authenticate);

router.post("/add-followup", addFollowup);
router.get("/followups", getAllFollowups);
router.get("/pending-followups", getPendingFollowups);
router.get("/overdue-followups", getOverdueFollowups);
router.get("/followups-activity", getFollowupActivity);
router.put("/followups/:id", updateFollowupStatus);

export default router;
