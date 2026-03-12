# Meeting-Multi: 목업 → VS Code Extension 구현 방안

> 역할극 기반 팀 회의 (8인) — 2026-03-13

## 회의 주제
목업(index.html + office.html)을 실제 VS Code Extension으로 구현할 때의 시스템 아키텍처, UI/UX 설계, 기술 스택

## 참여 팀원
| 이름 | 역할 | 연차 | 모델 |
|------|------|------|------|
| 지민 | PD · 프로젝트 디렉터 | 10y senior | Opus |
| 현우 | 기획 · 리서치 | 5y mid | Sonnet |
| 소연 | 기획 · 전략 | 8y senior | Sonnet |
| 태준 | 백엔드 개발 | 6y mid | Sonnet |
| 미래 | 프론트엔드 개발 | 3y junior | Sonnet |
| 윤서 | QA | 5y mid | Sonnet |
| 다은 | UI 디자인 | 4y mid | Sonnet |
| 승호 | UX 디자인 | 7y mid | Sonnet |

---

## 발언 기록

### 현우 — 기획 · 리서치 | mid 5y · Sonnet

타깃 사용자는 "VS Code에서 Claude Code를 쓰는 개발자". 핵심 유스케이스 3가지:

1. **코딩 중 즉시 팀 회의** — 사이드바에서 주제 입력 → 에이전트 8명 동시 실행 → 패널에서 스트리밍 확인
2. **PR 전 다각도 리뷰** — 코드 컨텍스트를 넘기고 팀원별 관점 피드백
3. **기획 문서 검토** — 기획자·개발자·QA 관점 동시 확보

목업 index.html의 UI 구조는 이미 유스케이스 1을 충실히 반영. 사이드바(팀원 선택) → 패널(결과 표시) 구조가 VS Code의 Sidebar + Editor Tab 패턴과 정확히 매핑.

**우려**: 목업에서는 "회의 방식" 선택(meeting-multi / meeting-agent / meeting-team)이 버튼 3개로 되어있는데, 사용자가 이 차이를 이해할 수 있는가? v1에서는 meeting-team 하나로 시작 제안.

**Must (v1)**: 팀원 선택, 회의 실행, 스트리밍 결과 확인, 결과 저장
**Should**: 비용 예측 실시간 표시, 팀원 연차/연봉 확인
**Won't (v1)**: 프로필 GUI 편집, 회의 이력 관리, 팀원 추가/삭제 UI

---

### 소연 — 기획 · 전략 | senior 8y · Sonnet

현우의 v1 스코프 판단에 동의하되, 전략적으로 한 가지 추가.

VS Code 마켓플레이스에 "멀티에이전트 팀 회의" 카테고리 자체가 없음. **First mover advantage**. 빠른 출시가 핵심.

**v1 KPI**:
- 마켓플레이스 설치 100+ (첫 달)
- 회의 실행률(설치 후 실제 회의 1회 이상) 70%+
- 평균 세션 비용 $0.10 이하 (진입장벽)

**포지셔닝**: "AI 팀원을 VS Code 안에서 바로 소환"

office.html(픽셀아트 오피스 씬)은 마케팅/온보딩용 GIF. Extension 내부 기능은 v2.

**우려**: 현우의 "1개 → 1개" 에 반대. meeting-multi(빠르고 싼)와 meeting-team(병렬)의 비용 차이 10배+. **비용 선택권**은 v1 KPI 달성에 필수. 최소 2가지 필요.

---

### 태준 — 백엔드 개발 | mid 6y · Sonnet

**1) Extension Host ↔ Webview 메시지 프로토콜**

```typescript
type WebviewMessage =
  | { type: 'startMeeting'; topic: string; participants: string[]; mode: MeetingMode }
  | { type: 'cancelMeeting'; meetingId: string }
  | { type: 'getTeam' }
  | { type: 'toggleMember'; memberId: string };

type HostMessage =
  | { type: 'teamData'; members: TeamMember[] }
  | { type: 'agentStream'; meetingId: string; agentId: string; chunk: string }
  | { type: 'agentDone'; meetingId: string; agentId: string; result: AgentResult }
  | { type: 'agentError'; meetingId: string; agentId: string; error: string }
  | { type: 'meetingDone'; meetingId: string; summary: MeetingResult };
```

메시지 ID + ACK는 오버엔지니어링. postMessage는 VS Code 내부 통신이라 유실 가능성 거의 없음. v1은 fire-and-forget 충분.

**2) 병렬 API 호출**

```typescript
async function runMeeting(config: MeetingConfig) {
  const tasks = config.participants.map(member =>
    runAgent(member, config.topic, {
      model: MODEL_MAP[member.salary],
      onStream: (chunk) => postToWebview({
        type: 'agentStream', meetingId: config.id,
        agentId: member.id, chunk
      })
    })
  );
  return Promise.allSettled(tasks);
}
```

**3) meeting-multi는 API 1회 호출**. 프롬프트에 8명 역할을 넣고 한 번에 생성. meeting-team(8회 병렬)보다 비용 1/8.

**우려**: 8명 동시 스트리밍 시 API rate limit. stagger(200ms 간격)로 대응.

**공수**: Extension Host 서비스 계층 = 약 4일.

---

### 미래 — 프론트엔드 개발 | junior 3y · Sonnet

**사이드바 컴포넌트 트리**
```
<App>
  <TeamSection>
    <MemberCard />
    ...
  </TeamSection>
  <CostEstimate />
  <MeetingLauncher />
</App>
```

**패널 컴포넌트 트리**
```
<MeetingPanel>
  <MeetingHeader />
  <ProgressBar />
  <AgentGrid>
    <AgentCard />
    ...
  </AgentGrid>
  <SummaryView />
  <ActionBar />
</MeetingPanel>
```

**픽셀아트 React 컴포넌트**:
```tsx
function PixelAvatar({ id, size }: { id: string; size: number }) {
  const char = PX[id];
  if (!char) return null;
  const ps = size / 16;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}
         style={{ imageRendering: 'pixelated' }}>
      {char.g.flatMap((row, y) =>
        row.map((ci, x) => ci ? (
          <rect key={`${y}-${x}`} x={x*ps} y={y*ps}
                width={ps+0.5} height={ps+0.5} fill={char.p[ci]} />
        ) : null)
      )}
    </svg>
  );
}
```

**우려**: Zustand를 사이드바와 패널에서 공유 불가. 두 Webview는 별도 프로세스. 상태 공유는 Extension Host 경유 필수.

**공수**: Webview 컴포넌트 전체 = 약 4일.

---

### 윤서 — QA | mid 5y · Sonnet

**[CRITICAL] API 키 보안**
- Webview에 API 키 절대 미노출
- Extension Host의 SecretStorage에서만 관리
- **테스트**: Webview DOM에서 키 검색 → 없어야 통과

**[HIGH] 8명 동시 스트리밍 Webview 렌더링**
- 100ms 디바운스 + requestAnimationFrame 배치 업데이트
- **테스트**: 8명 전원 동시 스트리밍 시 FPS ≥ 30

**[HIGH] 메시지 순서 보장**
- 스트리밍 chunk에 seq 번호 필수. ACK 불필요하지만 순서는 필요.

**[MEDIUM] 부분 실패 처리**
- 각 카드에 error 상태 + retry 버튼
- 성공한 결과 유지, 실패만 재시도

**DoD 기준**:
1. 8명 동시 스트리밍 시 화면 깨짐 없음
2. API 키 Webview 미노출
3. 1명 실패 시 나머지 7명 결과 정상 표시
4. 결과 Markdown 저장/복사 정상 동작

---

### 다은 — UI 디자인 | mid 4y · Sonnet

**디자인 토큰 매핑**:
```
목업 --bg (#1e1e1e)        → var(--vscode-editor-background)
목업 --fg (#cccccc)        → var(--vscode-foreground)
목업 --bg-sidebar (#252526) → var(--vscode-sideBar-background)
목업 --accent (#007acc)    → var(--vscode-focusBorder)
목업 --ok (#4ec9b0)        → var(--vscode-terminal-ansiGreen)
```

**팀원 카드 상태**: default / hover / inactive / disabled — VS Code CSS 변수로 자동 테마 대응.

**픽셀아트 아바타**: 카드 32px, AgentCard 28px, `image-rendering: pixelated`.

**연차 바**: junior(초록) / mid(파랑) / senior(보라) / lead(금).

**우려**: 패널 AgentCard 그리드 8개 → 2×4 배치 시 카드당 320px에서 아바타+텍스트 공간 빡빡함. 세로 배치 또는 아바타 24px 축소 필요.

---

### 승호 — UX 디자인 | mid 7y · Sonnet

**사용자 플로우**:
1. 최초 사용: Extension 설치 → API 키 입력 → 팀원 카드 표시 (profiles.json 없으면 기본 8명 자동 생성)
2. 일반 회의: 팀원 토글 → 주제 입력 → 방식 선택 → 비용 확인 → 시작 → 스트리밍 → 결과 저장
3. 컨텍스트 회의: 코드 선택 → 우클릭 → "Claude Team: 선택 코드로 회의" → 패널

**접근성**: Tab 순서, Enter 시작, Esc 취소, aria-label

**우려**: "meeting-multi"는 개발자 용어. 사용자에게는:
- **빠른 회의** (~$0.01) → meeting-multi
- **심층 회의** (~$0.10) → meeting-team

---

### 지민 — PD · 프로젝트 디렉터 | senior 10y · Opus

**[Go]** 2.5주 일정 현실적. 조정사항:

**v1 스코프 확정**:
1. ✅ 회의 방식 2가지 (meeting-multi + meeting-team)
2. ✅ 사이드바 + 패널 분리
3. ✅ 픽셀아트 → React PixelAvatar
4. ✅ office.html은 마케팅 GIF용
5. ✅ 프로필 편집 UI 미포함

**기술 결정**:
1. 메시지: fire-and-forget + seq 번호 (절충)
2. 상태 공유: Extension Host 경유 (제약 수용)
3. stagger: 200ms 간격

**일정**: Phase 1(3일) + Phase 2(2일) + Phase 3(5일) + Phase 4(2일) = **12일**

**크리티컬 패스**: Phase 3 "8명 병렬 스트리밍 + 에러 핸들링" (42%)

---

## 공통 합의점
1. 사이드바 + 패널 분리 구조 — 목업 레이아웃 ↔ VS Code 패턴 매핑
2. 픽셀아트 캐릭터 유지 — pxSvg → React PixelAvatar 컴포넌트
3. VS Code CSS 변수 매핑 — 테마 자동 연동
4. API 키는 Extension Host에서만 — Webview 노출 금지
5. office.html은 마케팅용 — Extension 내부 v2 이후

## 주요 쟁점 및 결론
| 쟁점 | 의견 A | 의견 B | 결론 |
|------|--------|--------|------|
| 회의 방식 수 | 현우: v1은 1가지 | 소연: 최소 2가지 | **2가지** (비용 선택권) |
| 메시지 ACK | 07-plan: ACK 패턴 | 태준: 불필요 | **seq만 추가** |
| Zustand 공유 | - | 미래: 불가 확인 | **Host 경유** |
| 용어 번역 | - | 승호: 개발자 용어 제거 | **빠른/심층 회의** |

## 권장 다음 액션
1. Phase 1 즉시 시작 — `yo code` Extension 초기화
2. messages.ts 타입 정의
3. PixelAvatar.tsx React 컴포넌트 구현
4. profiles.json 샘플 데이터 변환
5. Anthropic SDK POC

## 예상 토큰 사용량
| 역할 | 모델 | 입력 | 출력 | 비용 |
|------|------|------|------|------|
| 지민 (PD) | Opus | ~1,500 | ~800 | ~$0.069 |
| 현우 (기획①) | Sonnet | ~1,200 | ~600 | ~$0.011 |
| 소연 (기획②) | Sonnet | ~1,200 | ~700 | ~$0.012 |
| 태준 (백엔드) | Sonnet | ~1,200 | ~900 | ~$0.013 |
| 미래 (프론트) | Sonnet | ~1,200 | ~800 | ~$0.012 |
| 윤서 (QA) | Sonnet | ~1,200 | ~700 | ~$0.012 |
| 다은 (UI) | Sonnet | ~1,200 | ~700 | ~$0.012 |
| 승호 (UX) | Sonnet | ~1,200 | ~700 | ~$0.012 |
| **합계** | - | **~10,100** | **~5,900** | **~$0.153** |

> ※ meeting-multi(역할극) 방식 — 실제 단일 API 호출. 위 표는 meeting-team 가정 시 참고.
