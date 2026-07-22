// Format de message unifié — pivot de l'ingestion multi-canal (§13.2).

export type Channel = "whatsapp" | "gmail" | "imap";

export const CHANNELS: readonly Channel[] = ["whatsapp", "gmail", "imap"] as const;

export interface UnifiedMessage {
  id: string;
  channel: Channel;
  account: string;      // quel compte (perso/pro, numéro, adresse) — sert au cloisonnement
  from: string;
  timestamp: string;    // ISO 8601
  threadId?: string;
  subject?: string;
  content: string;
  raw?: unknown;        // charge brute d'origine, si nécessaire
}
