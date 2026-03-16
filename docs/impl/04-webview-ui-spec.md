# 04. Webview UI 스펙 — 컴포넌트, CSS 토큰, AgentCard 상태

> CRITICAL #2 (낙관적 UI), #3 (Markdown 복사/저장), HIGH #8 (AgentCard 상태) 해결
> 다은(UI), 미래(FE) 회의 결과 반영

---

## 1. CSS 변수 매핑 (20개 완성)

### 목업 → VS Code 변수

| # | 목업 변수 | HEX | VS Code 변수 | 용도 |
|---|----------|-----|-------------|------|
| 1 | `--bg` | `#1e1e1e` | `var(--vscode-editor-background)` | 메인 배경 |
| 2 | `--bg-sidebar` | `#252526` | `var(--vscode-sideBar-background)` | 사이드바, 카드 배경 |
| 3 | `--bg-activity` | `#333333` | `var(--vscode-activityBar-background)` | 액티비티바 |
| 4 | `--bg-titlebar` | `#3c3c3c` | `var(--vscode-titleBar-activeBackground)` | 타이틀바 |
| 5 | `--bg-input` | `#3c3c3c` | `var(--vscode-input-background)` | 인풋, 버튼 배경 |
| 6 | `--bg-tab` | `#2d2d2d` | `var(--vscode-editorGroupHeader-tabsBackground)` | 비활성 탭바 |
| 7 | `--bg-tab-active` | `#1e1e1e` | `var(--vscode-editor-background)` | 활성 탭 |
| 8 | `--fg` | `#cccccc` | `var(--vscode-foreground)` | 기본 텍스트 |
| 9 | `--fg-dim` | `#858585` | `var(--vscode-descriptionForeground)` | 보조 텍스트 |
| 10 | `--fg-bright` | `#e0e0e0` | `var(--vscode-editor-foreground)` | 강조 텍스트 |
| 11 | `--fg-muted` | `#6a6a6a` | `var(--vscode-disabledForeground)` | 비활성 텍스트 |
| 12 | `--border` | `#474747` | `var(--vscode-panel-border)` | 구분선 |
| 13 | `--border-s` | `#3a3a3a` | `var(--vscode-editorGroup-border)` | 미세 경계 |
| 14 | `--accent` | `#007acc` | `var(--vscode-focusBorder)` | 액센트 |
| 15 | `--accent-h` | `#1a8ad4` | `var(--vscode-button-hoverBackground)` | 호버 액센트 |
| 16 | `--ok` | `#4ec9b0` | `var(--vscode-terminal-ansiGreen)` | 성공/완료 |
| 17 | `--warn` | `#cca700` | `var(--vscode-editorWarning-foreground)` | 경고/retry |
| 18 | `--err` | `#f14c4c` | `var(--vscode-editorError-foreground)` | 에러 |
| 19 | `--info` | `#3794ff` | `var(--vscode-textLink-foreground)` | 링크/정보 |
| 20 | `--statusbar` | `#007acc` | `var(--vscode-statusBar-background)` | 상태바 |

---

## 2. 디자인 토큰 3계층

### 2.1 Primitive Tokens (`shared/tokens/primitive.css`)

```css
:root {
  /* 배경 */
  --color-bg-base:       var(--vscode-editor-background);
  --color-bg-elevated:   var(--vscode-sideBar-background);
  --color-bg-input:      var(--vscode-input-background);

  /* 텍스트 */
  --color-text-primary:  var(--vscode-editor-foreground);
  --color-text-secondary:var(--vscode-descriptionForeground);
  --color-text-muted:    var(--vscode-disabledForeground);
  --color-text-base:     var(--vscode-foreground);

  /* 테두리 */
  --color-border-base:   var(--vscode-panel-border);
  --color-border-subtle: var(--vscode-editorGroup-border);

  /* 상태 */
  --color-state-active:  var(--vscode-focusBorder);
  --color-state-success: var(--vscode-terminal-ansiGreen);
  --color-state-warn:    var(--vscode-editorWarning-foreground);
  --color-state-error:   var(--vscode-editorError-foreground);
  --color-state-info:    var(--vscode-textLink-foreground);
}
```

### 2.2 Semantic Tokens (`shared/tokens/semantic.css`)

```css
:root {
  /* AgentCard 상태별 테두리 */
  --agent-border-idle:       var(--color-border-subtle);
  --agent-border-streaming:  color-mix(in srgb, var(--color-state-active) 50%, transparent);
  --agent-border-done:       color-mix(in srgb, var(--color-state-success) 30%, transparent);
  --agent-border-error:      color-mix(in srgb, var(--color-state-error) 30%, transparent);
  --agent-border-retry:      color-mix(in srgb, var(--color-state-warn) 30%, transparent);
  --agent-border-cancelled:  var(--color-border-subtle);

  /* AgentCard 상태별 배경 tint */
  --agent-bg-idle:           var(--color-bg-elevated);
  --agent-bg-done:           color-mix(in srgb, var(--color-state-success) 3%, var(--color-bg-elevated));
  --agent-bg-error:          color-mix(in srgb, var(--color-state-error) 4%, var(--color-bg-elevated));
  --agent-bg-retry:          color-mix(in srgb, var(--color-state-warn) 3%, var(--color-bg-elevated));

  /* 연차 레벨 (VS Code 구문 강조 색상 차용) */
  --level-junior: #4fc1ff;   /* 파라미터 힌트 = 조용 = junior */
  --level-mid:    #dcdcaa;   /* 상수 = 안정 = mid */
  --level-senior: #ce9178;   /* 문자열 = 경험 = senior */
  --level-lead:   #c586c0;   /* 키워드 = 핵심 = lead */

  /* 연봉 뱃지 */
  --salary-low:    #6a9955;  /* 주석 색 */
  --salary-medium: #dcdcaa;
  --salary-high:   #c586c0;

  /* MemberCard */
  --mc-hover-bg:    rgba(255,255,255,.06);
  --mc-selected-bg: rgba(0,122,204,.15);
  --mc-disabled-opacity: 0.4;
}
```

### 2.3 Component Tokens (`shared/tokens/component.css`)

```css
:root {
  /* PixelAvatar */
  --avatar-size-sidebar: 36px;
  --avatar-size-card:    32px;

  /* AgentCard */
  --card-radius:         8px;
  --card-body-max-height: 220px;

  /* StatusDot */
  --dot-size: 7px;

  /* Cursor (스트리밍) */
  --cursor-width:  2px;
  --cursor-height: 14px;
  --cursor-color:  var(--color-state-active);

  /* XpBar (연차 바) */
  --xp-track-height: 3px;
  --xp-track-width:  48px;
}
```

---

## 3. AgentCard 6상태 시각 스펙

### idle (대기 중)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-idle)` |
| 배경 | `var(--agent-bg-idle)` |
| 상태 dot | `var(--color-text-muted)`, 정적 |
| 아바타 | 정적, 애니메이션 없음 |
| 텍스트 | "대기 중..." (italic, muted) |
| 불투명도 | `0.7` |

### streaming (응답 수신 중)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-streaming)` |
| 배경 | `var(--agent-bg-idle)` (변경 없음 — 8카드 동시 배경 변경 시 노이즈) |
| 상태 dot | `var(--color-state-active)`, `@keyframes blink 1s infinite` |
| 아바타 | `@keyframes talk { 0%,100%{translateY(0)} 50%{translateY(-1px)} } steps(2) 0.5s infinite` |
| 텍스트 | 실시간 스트리밍 + 커서 블링크 (`--cursor-color`, 0.8s) |
| 불투명도 | `1.0` |

### done (완료)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-done)` |
| 배경 | `var(--agent-bg-done)` |
| 상태 dot | `var(--color-state-success)`, 정적 |
| 아바타 | `::after` 체크마크 (12×12 원형, success 배경, "✓" 흰색 8px) |
| 텍스트 | 완성된 마크다운 (커서 없음) |
| 푸터 | `~2,100 토큰 · 12.3초` |
| 불투명도 | `1.0` |

### error (실패)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-error)` |
| 배경 | `var(--agent-bg-error)` |
| 상태 dot | `var(--color-state-error)`, 정적 (blink 안 씀 — streaming과 혼동 방지) |
| 아바타 | `::after` X마크 (12×12 원형, error 배경, "✕" 흰색 8px) |
| 텍스트 | 에러 메시지 (error 색상) + ⚠ 아이콘 (12px) |
| 버튼 | retry 가능 시: "↺ 재시도" 버튼 표시 |
| 불투명도 | `1.0` |

### retrying (재시도 중)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-retry)` |
| 배경 | `var(--agent-bg-retry)` |
| 상태 dot | `var(--color-state-warn)`, `@keyframes spin 1.5s linear infinite` |
| 텍스트 | "재시도 중... (2/2)" — 시도 횟수 표시 |
| 아이콘 | ↺ 회전 아이콘 (12px) |
| 불투명도 | `0.85` |

### cancelled (취소됨)
| 속성 | 값 |
|------|-----|
| 테두리 | `var(--agent-border-cancelled)` |
| 배경 | `var(--agent-bg-idle)` |
| 상태 dot | `var(--color-text-muted)`, 정적 |
| 텍스트 | "취소되었습니다" (italic, muted) |
| 불투명도 | `0.5` |

---

## 4. 컴포넌트 트리

### Sidebar Webview

```
<SidebarApp>
  <TeamSection title="정규직 (글로벌)" count={8}>
    <MemberCard member={m} onToggle={toggle}>
      <Checkbox checked={m.active} />
      <PixelAvatar id={m.id} size={36} />
      <MemberInfo>
        <Name>{m.name}</Name>
        <RoleLabel>{m.roleLabel}</RoleLabel>
        <XpBar level={m.experienceLevel} years={m.experience} />
        <SalaryBadge salary={m.salary} />
      </MemberInfo>
    </MemberCard>
    ...
  </TeamSection>

  <TeamSection title="비정규직 (프로젝트)" count={0} collapsed>
    <EmptySlot label="계약직 채용" />
  </TeamSection>

  <SidebarFooter>
    <CostEstimate count="7/8명" tokens="~16,800" cost="~$0.11" />
    <MeetingConfig>
      <TopicInput placeholder="회의 주제를 입력하세요..." />
      <ModeSelector modes={['quick', 'deep']} selected="deep" />
      <StartButton onClick={handleStart} />
    </MeetingConfig>
  </SidebarFooter>
</SidebarApp>
```

### Panel Webview

```
<PanelApp>
  <MeetingHeader>
    <Topic>{topic}</Topic>
    <MetaBadges>
      <Badge type="mode">{mode}</Badge>
      <Badge type="participants">{count}명 참여</Badge>
      <Badge type="status">{status}</Badge>
    </MetaBadges>
    <ProgressBar current={done} total={total} />
  </MeetingHeader>

  <AgentGrid columns="responsive">  {/* 2col → 3col@1200px → 4col@1600px */}
    <AgentCard agentId={id} status={status} onRetry={retry}>
      <CardHeader>
        <PixelAvatar id={id} size={32} />
        <AgentInfo name={name} level={level} model={model} />
        <StatusDot status={status} />
      </CardHeader>
      <CardBody>{content + cursor}</CardBody>
      <CardFooter>{tokens} · {duration}</CardFooter>
    </AgentCard>
    ...
  </AgentGrid>

  <SummaryView visible={meetingDone}>
    <SummaryHeader>📋 회의 요약</SummaryHeader>
    <SummaryContent>{summary}</SummaryContent>
  </SummaryView>

  <ActionBar>
    <CancelButton onClick={cancel} />
    <Spacer />
    <CopyButton onClick={copy} disabled={!done} />
    <SaveButton onClick={save} disabled={!done} />
    <NewMeetingButton onClick={newMeeting} disabled={!done} />
  </ActionBar>
</PanelApp>
```

---

## 5. 결과 복사/저장 (이슈 #3 해결)

### Markdown 복사

```
[Panel] "📋 Markdown 복사" 클릭
  ├── 버튼: "📋 복사" → "⏳ 복사 중..." (즉시)
  ├── postMessage → { type: 'copyResult', meetingId, format: 'markdown' }
  │
[Host]
  ├── 전체 결과를 Markdown 형식으로 조합
  │   # {topic} — 팀 회의 결과
  │   ## 지민 (PD)
  │   {content}
  │   ...
  ├── vscode.env.clipboard.writeText(markdown)
  ├── postToPanel → { type: 'copyDone' }
  │
[Panel]
  └── 버튼: "✓ 복사됨" (1.5초 후 원상복귀)
```

### 결과 저장

```
[Panel] "💾 결과 저장" 클릭
  ├── postMessage → { type: 'saveResult', meetingId }
  │
[Host]
  ├── 파일명 생성: {YYYYMMDD}-{topic-slug}.md
  ├── 저장 경로: 워크스페이스/.claude/meetings/{파일명}
  │   (워크스페이스 없으면 vscode.window.showSaveDialog)
  ├── vscode.workspace.fs.writeFile(uri, content)
  ├── postToPanel → { type: 'saveDone', filePath }
  │
[Panel]
  ├── 버튼: "✓ 저장됨" (1.5초 후 원상복귀)
  │
[Host]
  └── vscode.window.showInformationMessage('저장되었습니다', '파일 열기')
      └── 클릭 시 vscode.workspace.openTextDocument → vscode.window.showTextDocument
```

### 에지케이스
| 상황 | 처리 |
|------|------|
| 스트리밍 중 복사/저장 시도 | 버튼 disabled 유지 (meetingDone 전까지) |
| 빈 결과 | "저장할 내용이 없습니다" 경고 |
| 파일 이미 존재 | 덮어쓰기 confirm 다이얼로그 |
| 파일시스템 에러 | 에러 메시지 표시, 데이터 유실 없음 |

---

## 6. PixelAvatar 컴포넌트

```tsx
// shared/PixelAvatar.tsx
import { PIXEL_DATA } from './pixel-data';

interface PixelAvatarProps {
  id: string;
  size: number;  // 36 (sidebar) or 32 (card)
  className?: string;
}

export function PixelAvatar({ id, size, className }: PixelAvatarProps) {
  const char = PIXEL_DATA[id];
  if (!char) return null;

  const ps = size / 16;  // pixel size

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      className={className}
    >
      {char.grid.flatMap((row, y) =>
        row.map((colorIndex, x) =>
          colorIndex ? (
            <rect
              key={`${y}-${x}`}
              x={x * ps}
              y={y * ps}
              width={ps + 0.5}
              height={ps + 0.5}
              fill={char.palette[colorIndex]}
            />
          ) : null
        )
      )}
    </svg>
  );
}
```

픽셀 데이터는 `mockup/pages/index.html`의 `PX` 객체를 `shared/pixel-data.ts`로 변환.

---

## 7. useVscodeMessage 훅

```tsx
// shared/hooks/useVscodeMessage.ts
import { useEffect, useCallback } from 'react';

const vscodeApi = acquireVsCodeApi();

export function useVscodeMessage<T>(handler: (message: T) => void) {
  useEffect(() => {
    const listener = (event: MessageEvent<T>) => handler(event.data);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [handler]);
}

export function postMessage(message: WebviewMessage) {
  vscodeApi.postMessage(message);
}
```

---

## 8. 마크다운 렌더링

스트리밍 중 마크다운이 파싱 중간 상태(예: `**bold` 닫히기 전)에서 깨질 수 있으므로:

- **v1**: 정규식 기반 단순 치환 (목업과 동일)
  - `**text**` → `<strong>`
  - `` `code` `` → `<code>`
  - ```` ```code``` ```` → `<pre>`
- **v2**: `react-markdown` 도입 검토

깨진 마크다운은 날것으로 표시하되, 최종 `agentDone.content`에서 전체 재렌더링하여 정상 마크다운으로 교체.
