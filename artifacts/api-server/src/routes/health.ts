import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool } from "@workspace/db";

const HealthCheckResponse = z.object({ status: z.string() });

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ db: "ok" });
  } catch (err) {
    res.status(500).json({ db: "error", message: String(err) });
  }
});

export default router;
