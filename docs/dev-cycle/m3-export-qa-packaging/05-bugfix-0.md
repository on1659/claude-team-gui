# 버그 수정 보고서: M3 Export·QA·패키징 (사이클 #0)

╔══════════════════════════════════════════╗
║  개발 사이클: m3-export-qa-packaging      ║
║  현재 단계: 🔧 버그 수정 완료              ║
║  반복: 0/3                               ║
╚══════════════════════════════════════════╝

## 수정 결과

| Bug ID | 심각도 | 상태 | 수정 파일 | 변경 내용 |
|--------|--------|------|---------|---------|
| BUG-C1 | CRITICAL | ✅ 수정 완료 | `extension/src/services/config-service.ts:58` | `.catch()` → `try/catch` 블록 교체 |

**수정 전:**
```typescript
await this.secrets.store(`claude-team.apiKey.${providerId}`, oldKey).catch(() => {});
```

**수정 후:**
```typescript
try {
  await this.secrets.store(`claude-team.apiKey.${providerId}`, oldKey);
} catch {
  // 롤백 실패는 무시 (best-effort)
}
```

**검증:** `npm run typecheck` → 오류 0건 확인

## 미수정 항목 (MINOR → 다음 사이클 안건)

| Bug ID | 설명 | 사유 |
|--------|------|------|
| BUG-M1 | API 키 형식 사전검증 없음 (`config-service.setApiKey`) | 기능 영향 없음, v2 개선 안건 |
| BUG-M2 | 수동 retry시 서버 attempt 카운터 리셋 의미 불일치 | 실질 피해 없음 (retryable:false 차단), v2 개선 안건 |
| BUG-CO1 | `providers/` 레이어 console.log 17건 잔존 | 이번 범위 외, 다음 사이클 정리 |
