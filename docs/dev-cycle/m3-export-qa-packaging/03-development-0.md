# 개발 결과 보고서: M3 Export·QA·패키징 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: m3-export-qa-packaging      ║
║  현재 단계: 🟢 개발 완료                  ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 변경 파일 목록

| 파일 | 변경 유형 | 담당 | 설명 |
|------|---------|------|------|
| `extension/src/SidebarProvider.ts` | 수정 | 태준 (BE) | handlePanelMessage() 화이트리스트 + console.log 4건 제거 |
| `extension/src/services/config-service.ts` | 수정 | 태준 (BE) | setApiKey() SecretStorage 롤백 패턴 |
| `extension/src/services/meeting-service.ts` | 수정 | 태준 (BE) | console.log 6건 제거 (console.error 유지) |
| `extension/src/host/panel-manager.ts` | 수정 | 태준 (BE) | console.log 5건 제거 (console.warn 유지) |
| `extension/src/extension.ts` | 수정 | 태준 (BE) | console.log 2건 제거 |
| `extension/src/webview/panel/ProgressBar.tsx` | 수정 | 미래 (FE) + 다은 (UI) | width 클램핑 + cancelled opacity:0 |
| `extension/src/webview/panel/App.tsx` | 수정 | 미래 (FE) | cancelled attempt 1→0 + console.log 8건 제거 |
| `extension/src/webview/shared/hooks/useChunkBuffer.ts` | 수정 | 미래 (FE) | console.log 4건 제거 (console.warn 유지) |
| `extension/src/webview/panel/ActionBar.tsx` | 수정 | 다은 (UI) | 이모지 aria-hidden + 버튼 aria-label |
| `extension/src/webview/panel/SummaryView.tsx` | 수정 | 다은 (UI) | 토글 버튼 aria-expanded/aria-controls + 섹션 id |
| `extension/src/webview/panel/AgentCard.tsx` | 수정 | 다은 (UI) | error div role="alert" |
| `extension/src/webview/shared/tokens/component.css` | 수정 | 다은 (UI) | @keyframes blink 50% opacity 0으로 통일 (cursorBlink와 일치) |

총 변경 파일: **12개**

## 구현 상세

### 태준 (BE) 구현

**SEC-01: handlePanelMessage 화이트리스트**
```typescript
// SidebarProvider.ts — handlePanelMessage() 진입부
const ALLOWED_MESSAGE_TYPES = ['getTeam', 'cancelMeeting', 'copyResult', 'saveResult', 'retryAgent'] as const;
if (!ALLOWED_MESSAGE_TYPES.includes(msg.type)) {
  console.warn(`[Security] Unknown message type rejected: ${msg.type}`);
  return;
}
```

**DoD#7: SecretStorage 저장 실패 롤백**
```typescript
// config-service.ts — setApiKey()
async setApiKey(key: string): Promise<{ valid: boolean; error?: unknown }> {
  const oldKey = await this.context.secrets.get('apiKey') ?? null;
  try {
    await this.context.secrets.store('apiKey', key);
    return { valid: true };
  } catch (err) {
    if (oldKey !== null) {
      await this.context.secrets.store('apiKey', oldKey).catch(() => {});
    }
    return { valid: false, error: err };
  }
}
```

**console.log 제거 집계**
- `services/meeting-service.ts`: 6건 제거
- `host/panel-manager.ts`: 5건 제거
- `SidebarProvider.ts`: 4건 제거
- `extension.ts`: 2건 제거
- 소계: **17건**

### 미래 (FE) 구현

**ProgressBar width 클램핑**
```tsx
// ProgressBar.tsx
width: `${Math.min(100, Math.max(0, progress))}%`
// 변경 전: width: `${progress}%`
```

**cancelled attempt 수정**
```tsx
// App.tsx — meetingCancelled 케이스
agents[id] = { type: 'error', message: '취소됨', retryable: false, attempt: 0 };
// 변경 전: attempt: 1
```

**console.log 제거 집계**
- `App.tsx`: 8건 제거 (teamData, meetingStarted, agentStream, agentDone, meetingDone, meetingCancelled, mounted 등)
- `useChunkBuffer.ts`: 4건 제거 (rAF flush, flushAgent 등)
- 소계: **12건**

### 다은 (UI) 구현

**@keyframes 수정** (`component.css`)
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }  /* 0.3 → 0으로 통일 (cursorBlink와 일치) */
}
```

**ActionBar 접근성** (`ActionBar.tsx`)
```tsx
<span aria-hidden="true">📋</span>
<button aria-label="Markdown으로 복사">
<span aria-hidden="true">💾</span>
<button aria-label="파일로 저장">
<button aria-label="회의 중단">
```

**SummaryView 접근성** (`SummaryView.tsx`)
```tsx
<button aria-expanded={expanded} aria-controls="summary-expanded-sections">
<div id="summary-expanded-sections">
```

**ProgressBar cancelled 레이아웃 유지** (`ProgressBar.tsx`)
```tsx
// 변경 전: return null; (레이아웃 점프 발생)
// 변경 후:
return <div style={{ height: '3px', opacity: 0, visibility: 'hidden' }} aria-hidden="true" />;
```

**AgentCard error role="alert"** (`AgentCard.tsx`)
```tsx
<div role="alert">
  {/* error 상태 메시지 */}
</div>
```

## console.log 제거 총 집계

| 레이어 | 제거 수 | 유지 (warn/error) |
|--------|--------|-----------------|
| 서비스/호스트 (BE) | 17건 | console.error/warn 다수 유지 |
| 패널/훅 (FE) | 12건 | console.warn (seq gap) 유지 |
| **합계** | **29건** | — |

*나머지 `providers/` 레이어는 이번 범위 외 (다음 사이클)*

## 미해결 사항

- `providers/` 레이어 console.log 잔여 (약 18건) — 이번 범위 외
- OutputChannel 전환 — v2 범위

## QA 요청 사항

1. **SEC-01**: 허용 목록 외 메시지 타입 전송 시 console.warn 출력 + 처리 무시 확인
2. **DoD#7**: `secrets.store()` 실패 시뮬레이션 → 기존 키 복원 확인 (실제 실패는 인위적으로 테스트 어려움)
3. **ProgressBar**: progress=150 같은 초과값 전달 시 width가 100%를 넘지 않는지 확인
4. **cancelled attempt**: 취소 후 AgentCard가 attempt: 0 표시 확인 (AgentCard에서 attempt 표시 여부 확인)
5. **aria**: NVDA/VoiceOver 없이도 HTML 속성으로 정적 확인 가능
