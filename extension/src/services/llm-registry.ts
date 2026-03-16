import type { LLMProvider } from '../types/llm';
import type { ProviderInfo } from '../types/messages';

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeProviderId = 'anthropic';

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  getActive(): LLMProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) throw new Error(`Provider not found: ${this.activeProviderId}`);
    return provider;
  }

  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    this.activeProviderId = providerId;
  }

  getAll(): LLMProvider[] {
    return [...this.providers.values()];
  }

  getProviderInfo(): ProviderInfo[] {
    return this.getAll().map(p => ({
      id: p.id,
      name: p.name,
      hasKey: false,
      authMode: 'none' as const,
      models: p.getModels().map(m => ({ id: m.id, name: m.name, tier: m.tier })),
    }));
  }
}
