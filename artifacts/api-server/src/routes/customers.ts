import { Router, type IRouter } from "express";
import {
  listCustomers,
  getCustomer,
  updateCustomer,
  updateVisit,
} from "../controllers/customerController";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.use("/customers", authenticate);
router.use("/visits/:id", authenticate);

router.get("/customers",          listCustomers);
router.get("/customers/:id",      getCustomer);
router.put("/customers/:id",      updateCustomer);
router.put("/visits/:id",         updateVisit);

export default router;
