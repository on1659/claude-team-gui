# QA 보고서: M3 Export·QA·패키징 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: m3-export-qa-packaging      ║
║  현재 단계: 🔍 QA 완료                    ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 테스트 요약

| 티어 | 테스트 수 | 통과 | 실패 | 통과율 |
|------|---------|------|------|-------|
| Tier 1 (빌드 + 핵심 코드 검증) | 10항목 | 9 | 1 | 90% |
| Tier 2 (SEC/STR/ERR + 회귀) | 10항목 | 9 | 0 (WARN 1) | 100% |
| **합계** | **20항목** | **18** | **1** | **95%** |

---

## 버그 리포트

### 🔴 CRITICAL (즉시 수정, 사이클 블로킹)

| ID | 설명 | 재현 경로 | 영향 범위 |
|----|------|---------|---------|
| BUG-C1 | `config-service.ts:58` — `Thenable<void>`에 `.catch()` 불가 → TypeScript 컴파일 오류 | `npm run compile` 실행 | .vsix 패키징 불가 (빌드 중단) |

**재현 오류:**
```
src/services/config-service.ts(58,78): error TS2339:
  Property 'catch' does not exist on type 'Thenable<void>'.
```

**수정 방법:** `.catch()` 체이닝 → `try/catch` 블록으로 교체
```typescript
// 수정 전 (오류)
await this.secrets.store(`claude-team.apiKey.${providerId}`, oldKey).catch(() => {});

// 수정 후 (정상)
try {
  await this.secrets.store(`claude-team.apiKey.${providerId}`, oldKey);
} catch {
  // 롤백 실패는 무시 (best-effort)
}
```

---

### 🟠 MAJOR

없음.

---

### 🟡 MINOR (개선 사항, 다음 회의 안건)

| ID | 설명 | 개선 제안 |
|----|------|---------|
| BUG-M1 | `SEC-07`: API 키 저장 전 형식 사전 검증 없음. 빈 문자열/공백/특수문자가 `validateKey` 네트워크 요청으로 도달 가능 | `config-service.setApiKey()`에 `apiKey.trim().length > 0` + prefix 정규식 추가 |
| BUG-M2 | `ERR-10`: 수동 retry 클릭 시 서버의 attempt 카운터가 1부터 재시작하여 이론적으로 무한 retry 가능. 단, `retryable: false` 이후 버튼 차단으로 실질 피해 없음 | 서버에서 수동 retryAgent 요청 시 기존 attempt 카운터를 전달받도록 개선 |

---

### ⚪ COSMETIC (기록만, 통과)

| ID | 설명 |
|----|------|
| BUG-CO1 | `providers/` 레이어(claude-code.ts 16건, anthropic.ts 1건)에 console.log 잔존. 이번 작업 범위 외. |

---

## 검증 결과 상세

### Tier 1-B: 코드 존재 확인

| 항목 | 파일 | 판정 |
|------|------|------|
| SEC-01 화이트리스트 | SidebarProvider.ts:224 | ✅ PASS |
| DoD#7 롤백 로직 | config-service.ts:52-59 | ✅ PASS (로직 정상, 빌드만 오류) |
| ProgressBar 클램핑 | ProgressBar.tsx:61 | ✅ PASS |
| ProgressBar cancelled opacity:0 | ProgressBar.tsx:17-18 | ✅ PASS |
| cancelled attempt:0 | App.tsx:179 | ✅ PASS |
| console.log 제거 (4파일) | 0건 잔존 | ✅ PASS |
| ActionBar aria-hidden/label | ActionBar.tsx:71,79,85 | ✅ PASS |
| SummaryView aria-expanded/controls | SummaryView.tsx:38-39,58 | ✅ PASS |
| AgentCard role="alert" | AgentCard.tsx:167 | ✅ PASS |
| component.css blink opacity | component.css:24-32 | ✅ PASS |

### Tier 2: 정적 분석 결과

| 시나리오 | 판정 | 근거 |
|---------|------|------|
| SEC-01 완전성 | ✅ PASS | 허용 5개 = 처리 5개, 누락/유령 타입 없음 |
| SEC-07 형식 검증 | ⚠️ WARN | validateKey에 위임, 형식 사전검증 없음 |
| STR-04 seq gap | ✅ PASS | console.warn 유지됨, 청크 허용 통과 |
| STR-06 AbortController | ✅ PASS | 이중 abort 체계 (controller + signal 체크) |
| ERR-01 부분 실패 격리 | ✅ PASS | agentReducer 순수함수 + allSettled 격리 |
| ERR-10 max retry | ✅ PASS | retryable:false 이후 버튼 차단 정상 |
| ProgressBar 회귀 | ✅ PASS | opacity:0 div로 레이아웃 shift 개선 |
| ActionBar TS 타입 | ✅ PASS | ariaLabel: string 필수 타입, 3곳 모두 전달 |
| SummaryView aria-expanded | ✅ PASS | boolean → JSX 자동 직렬화 정상 |
| setApiKey 반환값 호출부 | ✅ PASS | 3개 호출 위치 모두 { valid, error } 처리 |

---

## QA 판정

**FAIL** — CRITICAL 1건 (TypeScript 빌드 오류)

- CRITICAL 1건: `config-service.ts:58` `.catch()` on Thenable → 빌드 실패 → .vsix 패키징 불가
- MAJOR 0건
- MINOR 2건 (다음 회의 안건)
- COSMETIC 1건 (기록만)

수정 방법이 명확하고 1줄 수정으로 해결 가능. 수정 후 재빌드 확인 필요.
