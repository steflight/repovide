// Human-in-the-loop — garde-fou déterministe : le LLM propose, le code dispose (§10.1).

export interface ApprovalRequest {
  action: string;
  summary: string;
}

export interface HumanGate {
  requestApproval(req: ApprovalRequest): Promise<boolean>;
}

// Stub MVP : refuse par défaut (fail-safe) tant que le canal de validation n'est pas branché.
// TODO Lot 0 : router la demande vers le chat web / notif mobile, et journaliser la décision.
export class DenyByDefaultGate implements HumanGate {
  async requestApproval(_req: ApprovalRequest): Promise<boolean> {
    return false;
  }
}
