import { createServer } from "node:http";
import { ConsoleAuditLog, EnvSecretsVault } from "@agoum7/core-security";
import { CHANNELS } from "@agoum7/shared";
import { MessageStore } from "./store.js";
import { ImapChannel, readImapConfig } from "./imap.js";

const audit = new ConsoleAuditLog();
const vault = new EnvSecretsVault();
const store = new MessageStore();
const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", component: "comm-0", channels: CHANNELS, ingested: store.size }));
    return;
  }

  // Aperçu en lecture seule des derniers messages ingérés (extrait tronqué).
  if (url.pathname === "/messages") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
    const messages = store.recent(limit).map((m) => ({
      id: m.id,
      channel: m.channel,
      account: m.account,
      from: m.from,
      timestamp: m.timestamp,
      subject: m.subject,
      snippet: m.content.slice(0, 200),
    }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ count: store.size, messages }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, async () => {
  audit.record({ actor: "system", action: "comm.start", detail: `listening on :${PORT}` });
  console.log(`Agoum7 Comm-0 up on :${PORT} — canaux prévus: ${CHANNELS.join(", ")}`);

  // Canal IMAP : démarré seulement si configuré (sinon mode health-only).
  const imapConfig = await readImapConfig(vault);
  if (imapConfig) {
    new ImapChannel(imapConfig, store, audit).start();
    audit.record({
      actor: "system",
      action: "comm.imap.enabled",
      detail: `${imapConfig.user}@${imapConfig.host} (lecture seule, ${imapConfig.pollMs}ms)`,
    });
    console.log(`IMAP activé (lecture seule) : ${imapConfig.user}@${imapConfig.host}`);
  } else {
    console.log("IMAP non configuré — mode health-only (voir apps/comm/.env.example).");
  }
});
