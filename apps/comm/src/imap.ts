// Canal IMAP — ingestion en LECTURE SEULE (Comm-0, §13.2).
//
// Garanties "lecture seule" :
//   - la boîte est ouverte en EXAMINE (readOnly) → le serveur ne pose jamais le flag \Seen ;
//   - aucune écriture, aucun déplacement, aucune suppression : on ne fait que lire.
// Les identifiants viennent du coffre (SecretsVault) au runtime, jamais du code (§10).

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AuditLog, SecretsVault } from "@agoum7/core-security";
import type { UnifiedMessage } from "@agoum7/shared";
import type { MessageStore } from "./store.js";

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  pollMs: number;
  fetchLimit: number;
}

/**
 * Lit la config IMAP depuis le coffre. Retourne null si non configurée
 * (host + user + password requis) → le service tourne alors en mode health-only.
 */
export async function readImapConfig(vault: SecretsVault): Promise<ImapConfig | null> {
  const host = await vault.get("IMAP_HOST");
  const user = await vault.get("IMAP_USER");
  const pass = await vault.get("IMAP_PASSWORD");
  if (!host || !user || !pass) return null;

  const port = Number((await vault.get("IMAP_PORT")) ?? 993);
  const secure = (await vault.get("IMAP_TLS")) !== "false";
  const pollMs = Math.max(15_000, Number((await vault.get("IMAP_POLL_MS")) ?? 60_000));
  const fetchLimit = Math.max(1, Number((await vault.get("IMAP_FETCH_LIMIT")) ?? 25));
  return { host, port, secure, user, pass, pollMs, fetchLimit };
}

export class ImapChannel {
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(
    private readonly config: ImapConfig,
    private readonly store: MessageStore,
    private readonly audit: AuditLog,
  ) {}

  /** Démarre le polling périodique (première passe immédiate). */
  start(): void {
    this.stopped = false;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async loop(): Promise<void> {
    if (this.stopped) return;
    try {
      await this.pollOnce();
    } catch (err) {
      // Jamais de secret dans le message loggé.
      this.audit.record({ actor: "imap", action: "comm.imap.error", detail: errMessage(err) });
    }
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.loop(), this.config.pollMs);
  }

  /** Une passe : connexion, lecture des N derniers messages, mapping, stockage. */
  private async pollOnce(): Promise<void> {
    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: { user: this.config.user, pass: this.config.pass },
      logger: false,
      emitLogs: false,
    });

    await client.connect();
    try {
      const mbox = await client.mailboxOpen("INBOX", { readOnly: true }); // EXAMINE
      if (mbox.exists === 0) {
        this.audit.record({ actor: "imap", action: "comm.imap.poll", detail: "boîte vide" });
        return;
      }

      const start = Math.max(1, mbox.exists - this.config.fetchLimit + 1);
      let fetched = 0;
      let added = 0;

      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, source: true })) {
        fetched++;
        const unified = await toUnifiedMessage(msg, this.config.user);
        if (this.store.add(unified)) added++;
      }

      this.audit.record({
        actor: "imap",
        action: "comm.imap.poll",
        detail: `+${added} nouveaux / ${fetched} lus (total ${this.store.size})`,
      });
    } finally {
      await client.logout().catch(() => {});
    }
  }
}

/** Map un message IMAP brut vers le format unifié (§13.2). */
async function toUnifiedMessage(
  msg: { uid: number; envelope?: unknown; source?: Buffer },
  account: string,
): Promise<UnifiedMessage> {
  const env = (msg.envelope ?? {}) as {
    messageId?: string;
    subject?: string;
    date?: Date;
    inReplyTo?: string;
    from?: Array<{ address?: string; name?: string }>;
  };
  const parsed = msg.source ? await simpleParser(msg.source) : undefined;

  const from =
    parsed?.from?.text ??
    env.from?.[0]?.address ??
    "inconnu";
  const references = parsed?.references;
  const threadId =
    parsed?.inReplyTo ??
    env.inReplyTo ??
    (Array.isArray(references) ? references[0] : references) ??
    undefined;
  const timestamp = (parsed?.date ?? env.date ?? new Date()).toISOString();

  return {
    id: env.messageId ?? `imap:${account}:${msg.uid}`,
    channel: "imap",
    account,
    from,
    timestamp,
    threadId,
    subject: parsed?.subject ?? env.subject,
    content: parsed?.text ?? "",
    // raw volontairement omis : limite mémoire et exposition de données perso.
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
