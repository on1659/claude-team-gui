import { useEffect, useCallback } from 'react';
import type { WebviewMessage, HostMessage } from '../../../types/messages';

interface VscodeApi {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VscodeApi;

let _api: VscodeApi | null = null;

function getApi(): VscodeApi {
  if (!_api) {
    _api = acquireVsCodeApi();
  }
  return _api;
}

/**
 * VS Code Webview ↔ Extension Host 통신 훅
 * @param onMessage Host에서 수신한 메시지 핸들러
 * @returns postMessage 함수
 */
export function useVscodeMessage(
  onMessage?: (message: HostMessage) => void,
): (message: WebviewMessage) => void {
  useEffect(() => {
    if (!onMessage) return;

    const handler = (event: MessageEvent<HostMessage>) => {
      onMessage(event.data);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage]);

  const postMessage = useCallback((message: WebviewMessage) => {
    getApi().postMessage(message);
  }, []);

  return postMessage;
}
