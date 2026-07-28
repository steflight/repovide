// Stockage des messages ingérés — MVP en mémoire (§13.2).
// TODO Lot suivant : persister en base chiffrée (les messages sont des données perso).

import type { UnifiedMessage } from "@agoum7/shared";

/**
 * Tampon circulaire borné : garde les N derniers messages ingérés, dédupliqués par id.
 * Volatile (perdu au redémarrage) — c'est voulu tant qu'on n'a pas de persistance chiffrée.
 */
export class MessageStore {
  private readonly byId = new Map<string, UnifiedMessage>();

  constructor(private readonly capacity = 200) {}

  /** Ajoute un message s'il est nouveau. Retourne true si ajouté, false si déjà connu. */
  add(msg: UnifiedMessage): boolean {
    if (this.byId.has(msg.id)) return false;
    this.byId.set(msg.id, msg);
    // Élague les plus anciens au-delà de la capacité (Map conserve l'ordre d'insertion).
    while (this.byId.size > this.capacity) {
      const oldest = this.byId.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.byId.delete(oldest);
    }
    return true;
  }

  /** Les messages les plus récents d'abord, éventuellement limités. */
  recent(limit?: number): UnifiedMessage[] {
    const all = [...this.byId.values()].reverse();
    return typeof limit === "number" ? all.slice(0, limit) : all;
  }

  get size(): number {
    return this.byId.size;
  }
}
