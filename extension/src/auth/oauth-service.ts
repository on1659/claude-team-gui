import * as vscode from 'vscode';

/**
 * Guided Login Service for API key providers (Anthropic, OpenAI, Gemini).
 *
 * Opens the provider's API key console in browser,
 * then shows an input box for the user to paste their key.
 *
 * Note: Claude Code CLI provider doesn't use this service at all —
 * it handles auth via its own OAuth flow.
 */

interface ProviderConsoleInfo {
  consoleUrl: string;
  placeholder: string;
  name: string;
}

const PROVIDER_CONSOLES: Record<string, ProviderConsoleInfo> = {
  anthropic: {
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api03-...',
    name: 'Anthropic',
  },
  openai: {
    consoleUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    name: 'OpenAI',
  },
  gemini: {
    consoleUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
    name: 'Google Gemini',
  },
};

export class OAuthService {
  constructor(
    private readonly _secrets: vscode.SecretStorage,
    private readonly _extensionId: string,
  ) {}

  /**
   * Guided login: open console in browser → show input box for API key.
   * Returns { apiKey } or null if cancelled.
   */
  async login(providerId: string): Promise<{ apiKey: string } | null> {
    const info = PROVIDER_CONSOLES[providerId];
    if (!info) return null;

    await vscode.env.openExternal(vscode.Uri.parse(info.consoleUrl));

    const apiKey = await vscode.window.showInputBox({
      title: `${info.name} API 키 입력`,
      prompt: `${info.name} 콘솔에서 API 키를 복사한 후 여기에 붙여넣으세요`,
      password: true,
      placeHolder: info.placeholder,
      ignoreFocusOut: true,
    });

    return apiKey ? { apiKey } : null;
  }
}
