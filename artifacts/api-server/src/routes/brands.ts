import { Router, type IRouter } from "express";
import { createBrand, listBrands } from "../controllers/brandController";

const router: IRouter = Router();

router.route("/brands").get(listBrands).post(createBrand);

export default router;