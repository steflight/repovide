// Journal d'audit — chaque action horodatée et rejouable (§10).

export interface AuditEntry {
  actor: string;
  action: string;
  detail?: string;
  timestamp?: string;
}

export interface AuditLog {
  record(entry: AuditEntry): void;
}

// Stub MVP : JSON lines sur stdout.
// TODO Lot 0 : persister en base chiffrée + rendre rejouable.
export class ConsoleAuditLog implements AuditLog {
  record(entry: AuditEntry): void {
    const line = { ...entry, timestamp: entry.timestamp ?? new Date().toISOString() };
    console.log(`[audit] ${JSON.stringify(line)}`);
  }
}
