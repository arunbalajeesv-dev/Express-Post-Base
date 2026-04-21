import { Router, type IRouter } from "express";
import authRouter from "./auth";
import brandsRouter from "./brands";
import followupsRouter from "./followups";
import healthRouter from "./health";
import usersRouter from "./users";
import visitsRouter from "./visits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(brandsRouter);
router.use(visitsRouter);
router.use(followupsRouter);

export default router;
