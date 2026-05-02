import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", router);

// Serve the React frontend for all non-API routes (production build)
const frontendPath = path.join(process.cwd(), "artifacts/sales-app/dist/public");
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
