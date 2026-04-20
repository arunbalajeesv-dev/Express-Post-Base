import { Router, type IRouter } from "express";
import brandsRouter from "./brands";
import healthRouter from "./health";
import usersRouter from "./users";
import visitsRouter from "./visits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(brandsRouter);
router.use(visitsRouter);

export default router;
