import { Router, type IRouter } from "express";
import { exportExcel, exportPdf } from "../controllers/exportController";
import { authenticate } from "../middlewares/authenticate";
import { requireManager } from "../middlewares/requireManager";

const router: IRouter = Router();

router.use(authenticate, requireManager);

router.get("/export/excel", exportExcel);
router.get("/export/pdf", exportPdf);

export default router;
