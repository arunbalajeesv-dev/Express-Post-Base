import { Router, type IRouter } from "express";
import { createBrand, listBrands } from "../controllers/brandController";
import { authenticate } from "../middlewares/authenticate";
import { requireManager } from "../middlewares/requireManager";

const router: IRouter = Router();

router.use("/brands", authenticate);
router.route("/brands").get(listBrands).post(requireManager, createBrand);

export default router;
