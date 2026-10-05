import cors from "cors";
import express from "express";
import cron from "node-cron";
import { env } from "./config/env.js";
import { alertaEntregasPendentes } from "./jobs/alertaEntregasPendentes.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { membrosRouter } from "./routes/membros.js";
import { moradoresRouter } from "./routes/moradores.js";

const app = express();

app.use(
  cors({
    origin: env.webUrl || env.corsOrigin || "http://localhost:3000",
    credentials: true
  })
);
app.use(express.json());

app.use("/membros", membrosRouter);
app.use("/moradores", moradoresRouter);
app.use("/dashboard", dashboardRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "condominio-api",
    timestamp: new Date().toISOString()
  });
});

cron.schedule("0 8 * * *", () => {
  void alertaEntregasPendentes();
});

app.listen(env.port, () => {
  console.log(`API running at http://localhost:${env.port}`);
});
