import { Router, type IRouter } from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireManager } from "../middlewares/requireManager";
import { createUser, login } from "../controllers/authController";

const router: IRouter = Router();

router.post("/login", login);
router.post("/create-user", authenticate, requireManager, createUser);

export default router;
