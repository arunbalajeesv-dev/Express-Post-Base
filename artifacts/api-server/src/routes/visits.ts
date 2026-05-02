import { Router, type IRouter } from "express";
import { createVisit, listVisits } from "../controllers/visitController";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.use("/visits", authenticate);
router.route("/visits").get(listVisits).post(createVisit);

export default router;
