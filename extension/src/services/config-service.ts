import * as vscode from 'vscode';
import type { LLMRegistry } from './llm-registry';
import type { OAuthService } from '../auth/oauth-service';
import type { AuthMode, ProviderInfo } from '../types/messages';

export class ConfigService {
  private oauthService: OAuthService | null = null;

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly registry: LLMRegistry,
  ) {}

  setOAuthService(service: OAuthService): void {
    this.oauthService = service;
  }

  get<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('claudeTeam');
    return config.get<T>(key, defaultValue);
  }

  async getProviderListForWebview(): Promise<{ providers: ProviderInfo[]; activeId: string }> {
    const infos = this.registry.getProviderInfo();
    const enriched = await Promise.all(
      infos.map(async (info) => {
        const hasKey = await this.hasKey(info.id);
        return {
          ...info,
          hasKey,
          authMode: (hasKey ? 'apiKey' : 'none') as AuthMode,
        };
      }),
    );
    return {
      providers: enriched,
      activeId: this.registry.getActive().id,
    };
  }

  async setApiKey(
    providerId: string,
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const provider = this.registry.getAll().find(p => p.id === providerId);
    if (!provider) return { valid: false, error: `Unknown provider: ${providerId}` };

    const valid = await provider.validateKey(apiKey);
    if (!valid) return { valid: false, error: 'API 키 검증 실패 — 키를 다시 확인하세요' };

    try {
      await this.secrets.store(`claude-team.apiKey.${providerId}`, apiKey);
    } catch (err: any) {
      return { valid: false, error: `Failed to store key: ${err.message}` };
    }

    provider.setApiKey(apiKey);
    return { valid: true };
  }

  async clearApiKey(providerId: string): Promise<void> {
    await this.secrets.delete(`claude-team.apiKey.${providerId}`);
  }

  /**
   * Login flow:
   * - Anthropic: tries Claude Code token first, falls back to API key input
   * - OpenAI/Gemini: opens console + input box
   */
  async loginProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.oauthService) {
      return { success: false, error: 'Login service not available' };
    }

    const provider = this.registry.getAll().find(p => p.id === providerId);
    if (!provider) return { success: false, error: `Unknown provider: ${providerId}` };

    const result = await this.oauthService.login(providerId);
    if (!result) {
      return { success: false, error: '취소됨' };
    }

    // API key — validate and store
    const setResult = await this.setApiKey(providerId, result.apiKey);
    return { success: setResult.valid, error: setResult.error };
  }

  /** Logout — clear stored key */
  async logoutProvider(providerId: string): Promise<void> {
    await this.secrets.delete(`claude-team.apiKey.${providerId}`);
  }

  /**
   * Load stored keys on activation.
   * For Anthropic, also tries Claude Code credentials.
   */
  async loadStoredKeys(): Promise<void> {
    for (const provider of this.registry.getAll()) {
      // Claude Code provider doesn't need stored keys
      if (provider.id === 'claude-code') continue;

      const key = await this.secrets.get(`claude-team.apiKey.${provider.id}`);
      if (key) {
        provider.setApiKey(key);
      }
    }
  }

  async hasKey(providerId: string): Promise<boolean> {
    // Claude Code CLI provider — always available (auth handled by CC itself)
    if (providerId === 'claude-code') return true;

    // Check stored API key
    if (await this.secrets.get(`claude-team.apiKey.${providerId}`)) return true;

    return false;
  }
}
