import { Router, type IRouter } from "express";
import { deleteUser, getUser, listUsers, updateUser } from "../controllers/userController";
import { authenticate } from "../middlewares/authenticate";
import { requireManager } from "../middlewares/requireManager";

const router: IRouter = Router();

router.use("/users", authenticate);

router.route("/users").get(listUsers);
router.route("/users/:id").get(getUser).put(requireManager, updateUser).delete(requireManager, deleteUser);

export default router;
