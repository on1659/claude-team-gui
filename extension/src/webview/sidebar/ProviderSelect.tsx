import React, { useState, useCallback, useEffect } from 'react';
import { useVscodeMessage } from '../shared/hooks/useVscodeMessage';
import type { HostMessage, ProviderInfo } from '../../types/messages';

/** Short display names for known providers */
const SHORT_NAMES: Record<string, string> = {
  'claude-code': 'Claude',
  anthropic: 'API',
  openai: 'GPT',
  gemini: 'Gemini',
};

interface ProviderSelectProps {
  /** Called when the active provider or its key status changes */
  onProviderChange?: (activeId: string, hasKey: boolean) => void;
}

export function ProviderSelect({ onProviderChange }: ProviderSelectProps): React.ReactElement {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loginPending, setLoginPending] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const postMessage = useVscodeMessage(
    useCallback((msg: HostMessage) => {
      switch (msg.type) {
        case 'providerList':
          setProviders(msg.providers);
          setActiveId(msg.activeId);
          break;
        case 'apiKeyValidated':
          if (msg.valid) {
            setProviders(prev =>
              prev.map(p => (p.id === msg.providerId ? { ...p, hasKey: true, authMode: 'apiKey' } : p)),
            );
            setStatusMessage(null);
          }
          break;
        case 'loginStarted':
          setLoginPending(msg.providerId);
          setStatusMessage('콘솔에서 키를 복사하세요...');
          break;
        case 'loginDone':
          setLoginPending(null);
          setStatusMessage('로그인 완료!');
          break;
        case 'loginFailed':
          setLoginPending(null);
          if (msg.error !== '취소됨') {
            setStatusMessage(`로그인 실패: ${msg.error}`);
          } else {
            setStatusMessage(null);
          }
          break;
        case 'logoutDone':
          setStatusMessage('로그아웃 완료');
          break;
      }
    }, []),
  );

  // Request provider list on mount
  useEffect(() => {
    postMessage({ type: 'getProviders' });
  }, [postMessage]);

  // Notify parent when provider state changes
  useEffect(() => {
    if (onProviderChange && activeId) {
      const active = providers.find(p => p.id === activeId);
      onProviderChange(activeId, active?.hasKey ?? false);
    }
  }, [activeId, providers, onProviderChange]);

  // Auto-dismiss status message after 3 seconds
  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  function handleSelect(providerId: string) {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    if (!provider.hasKey) {
      // No key → start guided login (opens console + input box)
      postMessage({ type: 'login', providerId });
      return;
    }

    setActiveId(providerId);
    postMessage({ type: 'setProvider', providerId });
  }

  function handleAuthAction(providerId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    if (provider.hasKey) {
      postMessage({ type: 'logout', providerId });
    } else {
      postMessage({ type: 'login', providerId });
    }
  }

  if (providers.length === 0) {
    return <div />;
  }

  return (
    <div style={{ padding: '4px 0 8px' }}>
      {/* Segmented control */}
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--color-border-base)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {providers.map((provider, idx) => {
          const isActive = provider.id === activeId;
          const label = SHORT_NAMES[provider.id] ?? provider.name;
          const isLoggingIn = loginPending === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              disabled={isLoggingIn}
              title={
                provider.hasKey
                  ? `${provider.name} (인증됨) — 클릭하여 전환`
                  : `${provider.name} — 클릭하여 로그인`
              }
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                border: 'none',
                borderLeft: idx > 0 ? '1px solid var(--color-border-base)' : 'none',
                background: isActive
                  ? 'var(--vscode-button-background, var(--color-state-active))'
                  : 'transparent',
                color: isActive
                  ? 'var(--vscode-button-foreground, #fff)'
                  : 'var(--color-text-secondary)',
                cursor: isLoggingIn ? 'wait' : 'pointer',
                outline: 'none',
                transition: 'background 0.15s, color 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
              }}
            >
              <span>{isLoggingIn ? '...' : label}</span>
              {!provider.hasKey && !isLoggingIn && (
                <span
                  onClick={(e) => handleAuthAction(provider.id, e)}
                  style={{
                    fontSize: '9px',
                    opacity: 0.7,
                    cursor: 'pointer',
                    padding: '0 2px',
                    textDecoration: 'underline',
                  }}
                  title="클릭하여 로그인"
                >
                  로그인
                </span>
              )}
              {provider.hasKey && (
                <span
                  style={{
                    fontSize: '8px',
                    opacity: isActive ? 0.8 : 0.5,
                  }}
                  title="API 키 설정됨"
                >
                  ◆
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status message */}
      {statusMessage && (
        <div
          style={{
            fontSize: '10px',
            color: statusMessage.includes('실패')
              ? 'var(--color-state-error, #f44)'
              : statusMessage.includes('완료')
                ? 'var(--color-state-success, #4a4)'
                : 'var(--color-state-warn, #fa0)',
            marginTop: '4px',
            padding: '0 2px',
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
