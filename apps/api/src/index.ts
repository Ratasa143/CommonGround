import { createPool } from "../../../packages/db/src/index.js";
import { buildApp } from "./app.js";

const pool = createPool();
const app = await buildApp(pool);
app.addHook("onClose", async () => pool.end());

try {
  await app.listen({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3001),
  });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
