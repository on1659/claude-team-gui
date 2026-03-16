import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import type { ProfileManager } from './services/profile-manager';
import type { ConfigService } from './services/config-service';
import type { LLMRegistry } from './services/llm-registry';
import type { PanelManager } from './host/panel-manager';
import type { MeetingService } from './services/meeting-service';
import type { MeetingResultStore } from './services/meeting-result-store';
import type { MeetingHistoryService } from './services/meeting-history-service';
import type { WebviewMessage, HostMessage, TeamMemberView } from './types/messages';
import type { MeetingConfig } from './types/team';
import { estimateCost } from './services/cost-estimator';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeTeam.sidebar';
  private webviewView: vscode.WebviewView | null = null;

  private meetingService: MeetingService | null = null;
  private resultStore: MeetingResultStore | null = null;
  private historyService: MeetingHistoryService | null = null;
  private currentMeetingId: string | null = null;
  private currentTopic: string | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly profileManager: ProfileManager,
    private readonly configService: ConfigService,
    private readonly registry: LLMRegistry,
    private readonly panelManager: PanelManager,
  ) {}

  setMeetingService(service: MeetingService): void {
    this.meetingService = service;
  }

  setResultStore(store: MeetingResultStore): void {
    this.resultStore = store;
  }

  setHistoryService(service: MeetingHistoryService): void {
    this.historyService = service;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
      ],
    };

    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
    );
  }

  post(message: HostMessage): void {
    // Track meeting lifecycle for provider switch blocking
    if (message.type === 'meetingDone' || message.type === 'meetingCancelled') {
      this.currentMeetingId = null;
    }
    this.webviewView?.webview.postMessage(message);
  }

  async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'getTeam': {
        const members = this.profileManager.getMembers();
        const views: TeamMemberView[] = members.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          roleLabel: m.roleLabel,
          experience: m.experience,
          experienceLevel: m.experienceLevel,
          salary: m.salary,
          active: m.active,
          description: m.description,
        }));
        this.post({ type: 'teamData', members: views });

        // Send initial cost estimate
        this.sendCostEstimate(members.filter(m => m.active));
        break;
      }

      case 'toggleMember': {
        this.profileManager.toggleMember(message.memberId);
        const active = this.profileManager.getActiveMembers();
        this.sendCostEstimate(active);
        break;
      }

      case 'getProviders': {
        const result = await this.configService.getProviderListForWebview();
        this.post({ type: 'providerList', ...result });
        break;
      }

      case 'setProvider': {
        // Block provider switch while meeting is running
        if (this.currentMeetingId && this.meetingService) {
          break;
        }
        try {
          this.registry.setActive(message.providerId);
          // Recalculate cost estimate with new provider
          const active = this.profileManager.getActiveMembers();
          this.sendCostEstimate(active);
          // Notify webview of updated provider list
          const providerList = await this.configService.getProviderListForWebview();
          this.post({ type: 'providerList', ...providerList });
        } catch {
          // Unknown provider — ignore
        }
        break;
      }

      case 'setApiKey': {
        const result = await this.configService.setApiKey(message.providerId, message.apiKey);
        this.post({
          type: 'apiKeyValidated',
          providerId: message.providerId,
          valid: result.valid,
          error: result.error,
        });
        break;
      }

      case 'login': {
        this.post({ type: 'loginStarted', providerId: message.providerId });
        const loginResult = await this.configService.loginProvider(message.providerId);
        if (loginResult.success) {
          this.post({ type: 'loginDone', providerId: message.providerId });
          const loginProviderList = await this.configService.getProviderListForWebview();
          this.post({ type: 'providerList', ...loginProviderList });
        } else {
          this.post({ type: 'loginFailed', providerId: message.providerId, error: loginResult.error ?? 'Unknown error' });
        }
        break;
      }

      case 'logout': {
        await this.configService.logoutProvider(message.providerId);
        this.post({ type: 'logoutDone', providerId: message.providerId });
        const logoutProviderList = await this.configService.getProviderListForWebview();
        this.post({ type: 'providerList', ...logoutProviderList });
        break;
      }

      case 'getHistory': {
        if (this.historyService) {
          const result = await this.historyService.list(message.page, 20);
          this.post({ type: 'historyList', ...result, page: message.page });
        }
        break;
      }

      case 'loadHistory': {
        if (this.historyService) {
          const entry = await this.historyService.load(message.meetingId);
          if (entry) {
            this.post({ type: 'historyDetail', entry });
          }
        }
        break;
      }

      case 'startMeeting': {
        console.log(`[Sidebar] startMeeting — topic="${message.topic}", participants=${message.participants.length}, mode=${message.mode}`);
        if (!this.meetingService) {
          console.error('[Sidebar] startMeeting — NO meetingService!');
          break;
        }
        this.panelManager.show();
        console.log('[Sidebar] panelManager.show() called');

        const participants = message.participants
          .map(id => this.profileManager.getMember(id))
          .filter((m): m is import('./types/team').TeamMember => !!m);

        console.log(`[Sidebar] resolved participants: ${participants.map(p => p.id).join(', ')} (${participants.length}/${message.participants.length})`);
        if (participants.length === 0) {
          console.warn('[Sidebar] No valid participants found — aborting');
          break;
        }

        const meetingConfig: MeetingConfig = {
          id: `meeting-${Date.now()}`,
          topic: message.topic,
          mode: message.mode,
          participants,
          createdAt: Date.now(),
        };

        this.currentMeetingId = meetingConfig.id;
        this.currentTopic = message.topic;

        // Track meeting in result store for copy/save
        this.resultStore?.trackMeeting(
          meetingConfig.id,
          message.topic,
          participants.map(p => ({ id: p.id, name: p.name, roleLabel: p.roleLabel })),
          message.mode,
        );

        // Notify sidebar only (MeetingService will notify panel)
        this.post({ type: 'meetingStarted', meetingId: meetingConfig.id, participants: message.participants, topic: message.topic, mode: message.mode });

        console.log(`[Sidebar] calling meetingService.startMeeting(${meetingConfig.id})`);
        this.meetingService.startMeeting(meetingConfig);
        console.log(`[Sidebar] meetingService.startMeeting() returned — async meeting running`);
        break;
      }
    }
  }

  handlePanelMessage(message: WebviewMessage): void {
    switch (message.type) {
      case 'getTeam': {
        // Panel also requests team data for display names
        const members = this.profileManager.getMembers();
        const views: TeamMemberView[] = members.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          roleLabel: m.roleLabel,
          experience: m.experience,
          experienceLevel: m.experienceLevel,
          salary: m.salary,
          active: m.active,
          description: m.description,
        }));
        this.panelManager.post({ type: 'teamData', members: views });
        break;
      }
      case 'cancelMeeting': {
        if (this.meetingService && message.meetingId) {
          this.meetingService.cancelMeeting(message.meetingId);
          this.post({ type: 'meetingCancelled', meetingId: message.meetingId });
        }
        break;
      }
      case 'retryAgent': {
        if (this.meetingService && message.meetingId) {
          const member = this.profileManager.getMember(message.agentId);
          if (member && this.currentTopic) {
            this.meetingService.retryAgent(message.meetingId, message.agentId, member, this.currentTopic);
          }
        }
        break;
      }
      case 'copyResult': {
        this.handleCopyResult(message.meetingId);
        break;
      }
      case 'saveResult': {
        this.handleSaveResult(message.meetingId);
        break;
      }
    }
  }

  private async handleCopyResult(meetingId: string): Promise<void> {
    const markdown = this.resultStore?.formatAsMarkdown(meetingId);
    if (!markdown) {
      vscode.window.showWarningMessage('회의 결과를 찾을 수 없습니다.');
      this.panelManager.post({ type: 'copyFailed', error: '회의 결과를 찾을 수 없습니다.' });
      return;
    }
    await vscode.env.clipboard.writeText(markdown);
    this.panelManager.post({ type: 'copyDone' });
  }

  private async handleSaveResult(meetingId: string): Promise<void> {
    const markdown = this.resultStore?.formatAsMarkdown(meetingId);
    if (!markdown) {
      vscode.window.showWarningMessage('회의 결과를 찾을 수 없습니다.');
      this.panelManager.post({ type: 'saveFailed', error: '회의 결과를 찾을 수 없습니다.' });
      return;
    }
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`meeting-${new Date().toISOString().slice(0, 10)}.md`),
      filters: { Markdown: ['md'] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf-8'));
      this.panelManager.post({ type: 'saveDone', filePath: uri.fsPath });
    }
  }

  private sendCostEstimate(activeMembers: import('./types/team').TeamMember[]): void {
    try {
      const provider = this.registry.getActive();
      const estimated = estimateCost(activeMembers, 'deep', provider);
      this.post({ type: 'costUpdate', estimated });
    } catch {
      // Provider not available yet
    }
  }

  private uri(webview: vscode.Webview, ...segments: string[]): string {
    return webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...segments))
      .toString();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const baseUri = this.uri(webview) + '/';
    const sidebarJs = this.uri(webview, 'sidebar.js');
    const cssUri = this.uri(webview, 'assets', 'PixelAvatar.css');

    return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <base href="${baseUri}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} data:;" />
  <link rel="stylesheet" href="${cssUri}" />
  <title>Claude Team Sidebar</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${sidebarJs}"></script>
</body>
</html>`;
  }
}
