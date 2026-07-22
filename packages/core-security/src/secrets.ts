// Accès aux secrets — jamais dans le code ni le contexte du LLM (§10).

export interface SecretsVault {
  get(key: string): Promise<string | undefined>;
}

// Stub MVP : lit les variables d'environnement (injectées par le coffre au runtime).
// TODO Lot 0 : brancher un vrai coffre (sops/age ou Vault).
export class EnvSecretsVault implements SecretsVault {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }
}
