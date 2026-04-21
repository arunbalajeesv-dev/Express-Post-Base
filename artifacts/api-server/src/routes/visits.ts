import { Router, type IRouter } from "express";
import { createVisit } from "../controllers/visitController";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.use("/visits", authenticate);
router.route("/visits").post(createVisit);

export default router;
