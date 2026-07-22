import { createServer } from "node:http";
import { ConsoleAuditLog } from "@agoum7/core-security";
import { CHANNELS } from "@agoum7/shared";

const audit = new ConsoleAuditLog();
const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", component: "comm-0", channels: CHANNELS }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  audit.record({ actor: "system", action: "comm.start", detail: `listening on :${PORT}` });
  console.log(`Agoum7 Comm-0 up on :${PORT} — canaux prévus: ${CHANNELS.join(", ")}`);
});
