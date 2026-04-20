import { Router, type IRouter } from "express";
import { createVisit } from "../controllers/visitController";

const router: IRouter = Router();

router.route("/visits").post(createVisit);

export default router;