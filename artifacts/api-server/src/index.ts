import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminIfEmpty } from "./lib/store";
import { cleanupOldResolvedBreakdowns } from "./routes/breakdowns";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

seedAdminIfEmpty()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      cleanupOldResolvedBreakdowns().catch(() => {});
      setInterval(() => cleanupOldResolvedBreakdowns().catch(() => {}), CLEANUP_INTERVAL_MS);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to seed admin");
    process.exit(1);
  });
