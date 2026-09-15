import { createServer } from "node:http";
import { configFrom } from "./config.ts";
import { createRepository } from "./repository.ts";
import { DemoPhone, realPhone } from "./providers.ts";
import { createApp } from "./app.ts";
import { createWorker } from "./worker.ts";
import { attachRealtime } from "./realtime.ts";
const config = configFrom(),
  repo = createRepository(config),
  phone = config.demo ? new DemoPhone() : realPhone(config);
const app = createApp(config, repo, phone),
  server = createServer(app),
  worker = createWorker(repo, phone, config),
  sockets = attachRealtime(server, repo, phone, config);
const stopWorker = worker.start();
server.listen(config.port, config.host, () =>
  console.log(
    `Moonline API: http://${config.host}:${config.port} (${config.demo ? "DEMO" : "REAL"})`,
  ),
);
async function shutdown() {
  stopWorker();
  for (const ws of sockets.clients) ws.close();
  server.close(async () => {
    await repo.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
