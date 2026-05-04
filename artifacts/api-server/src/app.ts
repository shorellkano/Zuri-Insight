import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
// @ts-ignore
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
    }, })
      res(res: any) {
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

app.use("/api", router);

// Global error handler — always return JSON, never HTML
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err?.message ?? "Internal server error";
  logger.error({ err, status }, "Unhandled error");
  res.status(status).json({ error: message });
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../zuri-ai/dist/public");
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
