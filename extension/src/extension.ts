import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { PanelManager } from './host/panel-manager';
import { ProfileManager } from './services/profile-manager';
import { LLMRegistry } from './services/llm-registry';
import { ConfigService } from './services/config-service';
import { ClaudeCodeProvider } from './providers/claude-code';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { MeetingService } from './services/meeting-service';
import { MeetingResultStore } from './services/meeting-result-store';
import { MeetingHistoryService } from './services/meeting-history-service';
import { OAuthService } from './auth/oauth-service';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Services
  const profileManager = new ProfileManager(context.extensionUri);
  await profileManager.load();

  const registry = new LLMRegistry();

  // Claude Code CLI provider (uses CC's OAuth, no API key needed)
  const ccProvider = new ClaudeCodeProvider();
  const ccAvailable = await ccProvider.detect();
  if (ccAvailable) {
    registry.register(ccProvider);
  }

  // API key providers (fallback)
  registry.register(new AnthropicProvider());
  registry.register(new OpenAIProvider());
  registry.register(new GeminiProvider());

  // Set Claude Code as default if available
  if (ccAvailable) {
    registry.setActive('claude-code');
  }

  const configService = new ConfigService(context.secrets, registry);

  // Guided login service for API key providers
  const extensionId = `${context.extension.packageJSON.publisher}.${context.extension.packageJSON.name}`;
  const oauthService = new OAuthService(context.secrets, extensionId);
  configService.setOAuthService(oauthService);

  await configService.loadStoredKeys();

  const panelManager = new PanelManager(context.extensionUri);
  const meetingService = new MeetingService(registry, panelManager, configService);

  // History service — persists completed meetings to workspace files
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const historyService = new MeetingHistoryService(workspaceRoot);

  // Result store — captures agentDone/meetingDone events for copy/save
  const resultStore = new MeetingResultStore();
  resultStore.setHistoryService(historyService);
  resultStore.subscribeTo(meetingService);

  // Sidebar
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    profileManager,
    configService,
    registry,
    panelManager,
  );
  sidebarProvider.setMeetingService(meetingService);
  sidebarProvider.setResultStore(resultStore);
  sidebarProvider.setHistoryService(historyService);

  // Panel → Host message routing
  panelManager.onMessage(message => sidebarProvider.handlePanelMessage(message));

  // Meeting lifecycle → Sidebar (meetingDone/meetingCancelled update button state)
  meetingService.onEvent(message => sidebarProvider.post(message));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider,
    ),

    vscode.commands.registerCommand('claudeTeam.openPanel', () => {
      panelManager.show();
    }),

    vscode.commands.registerCommand('claudeTeam.startMeeting', () => {
      // Editor context menu: use selected text as topic
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.document.getText(editor.selection);
      if (selection) {
        const participants = profileManager.getActiveMembers();
        if (participants.length === 0) {
          vscode.window.showWarningMessage('활성화된 팀원이 없습니다.');
          return;
        }
        // Delegate to sidebar's startMeeting flow for consistent wiring
        sidebarProvider.handleMessage({
          type: 'startMeeting',
          topic: selection,
          participants: participants.map(m => m.id),
          mode: configService.get<'quick' | 'deep'>('defaultMode', 'deep'),
        });
      } else {
        vscode.window.showInformationMessage('텍스트를 선택한 후 회의를 시작하세요.');
      }
    }),

    // Login command — guided login (opens console + input box)
    vscode.commands.registerCommand('claudeTeam.login', async () => {
      const providers = registry.getAll();
      const picks = await Promise.all(
        providers.map(async (p) => ({
          label: p.name,
          description: (await configService.hasKey(p.id)) ? '(인증됨)' : '',
          providerId: p.id,
        })),
      );

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: '로그인할 프로바이더를 선택하세요',
      });
      if (!selected) return;

      const result = await configService.loginProvider(selected.providerId);
      if (result.success) {
        vscode.window.showInformationMessage(`${selected.label} 로그인 완료!`);
        const providerList = await configService.getProviderListForWebview();
        sidebarProvider.post({ type: 'providerList', ...providerList });
      } else if (result.error !== '취소됨') {
        vscode.window.showErrorMessage(`로그인 실패: ${result.error}`);
      }
    }),

    // API key — direct input (no console open)
    vscode.commands.registerCommand('claudeTeam.setApiKey', async () => {
      const providers = registry.getAll();
      const picks = await Promise.all(
        providers.map(async (p) => ({
          label: p.name,
          description: (await configService.hasKey(p.id)) ? '(인증됨)' : '',
          providerId: p.id,
        })),
      );

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'API 키를 설정할 프로바이더를 선택하세요',
      });
      if (!selected) return;

      const placeholders: Record<string, string> = {
        anthropic: 'sk-ant-...',
        openai: 'sk-...',
        gemini: 'AIza...',
      };

      const apiKey = await vscode.window.showInputBox({
        prompt: `${selected.label} API 키를 입력하세요`,
        password: true,
        placeHolder: placeholders[selected.providerId] ?? 'API key',
        ignoreFocusOut: true,
      });
      if (!apiKey) return;

      const result = await configService.setApiKey(selected.providerId, apiKey);
      if (result.valid) {
        vscode.window.showInformationMessage(`${selected.label} API 키가 설정되었습니다.`);
        const providerList = await configService.getProviderListForWebview();
        sidebarProvider.post({ type: 'providerList', ...providerList });
      } else {
        vscode.window.showErrorMessage(`API 키 검증 실패: ${result.error}`);
      }
    }),

    vscode.commands.registerCommand('claudeTeam.clearApiKey', async () => {
      const providers = registry.getAll();
      const picks = await Promise.all(
        providers.map(async (p) => ({
          label: p.name,
          description: (await configService.hasKey(p.id)) ? '(인증됨)' : '(미인증)',
          providerId: p.id,
        })),
      );

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: '로그아웃할 프로바이더를 선택하세요',
      });
      if (!selected) return;

      await configService.logoutProvider(selected.providerId);
      vscode.window.showInformationMessage(`${selected.label} 인증이 초기화되었습니다.`);
      const providerList = await configService.getProviderListForWebview();
      sidebarProvider.post({ type: 'providerList', ...providerList });
    }),
  );

}

export function deactivate(): void {
  // cleanup
}
