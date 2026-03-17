import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import type { HostMessage, WebviewMessage } from '../types/messages';

export class PanelManager {
  private panel: vscode.WebviewPanel | null = null;
  private messageHandler: ((message: WebviewMessage) => void) | null = null;
  /** Whether the webview JS has loaded and sent its first message */
  private ready = false;
  /** Messages queued before the webview was ready */
  private pendingMessages: HostMessage[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  onMessage(handler: (message: WebviewMessage) => void): void {
    this.messageHandler = handler;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // New panel — webview JS hasn't loaded yet
    this.ready = false;
    this.pendingMessages = [];

    this.panel = vscode.window.createWebviewPanel(
      'claudeTeam.meeting',
      'Claude Team Meeting',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        // First message from webview = JS has loaded and listener is active
        if (!this.ready) {
          this.ready = true;
          for (const msg of this.pendingMessages) {
            this.panel?.webview.postMessage(msg);
          }
          this.pendingMessages = [];
        }
        this.messageHandler?.(message);
      },
    );

    this.panel.onDidDispose(() => {
      this.panel = null;
      this.ready = false;
      this.pendingMessages = [];
    });
  }

  post(message: HostMessage): void {
    if (!this.panel) {
      console.warn(`[PanelManager] post(${message.type}) — NO PANEL, message dropped!`);
      return;
    }
    if (!this.ready) {
      // Webview JS not loaded yet — buffer for later
      this.pendingMessages.push(message);
      return;
    }
    this.panel.webview.postMessage(message);
  }

  isVisible(): boolean {
    return this.panel?.visible ?? false;
  }

  private uri(webview: vscode.Webview, ...segments: string[]): string {
    return webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', ...segments))
      .toString();
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const baseUri = this.uri(webview) + '/';
    const panelJs = this.uri(webview, 'panel.js');
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
  <title>Claude Team Meeting</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${panelJs}"></script>
</body>
</html>`;
  }
}
