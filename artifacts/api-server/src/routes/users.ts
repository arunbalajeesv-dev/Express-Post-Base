import { Router, type IRouter } from "express";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from "../controllers/userController";

const router: IRouter = Router();

router.route("/users").get(listUsers).post(createUser);
router.route("/users/:id").get(getUser).put(updateUser).delete(deleteUser);

export default router;