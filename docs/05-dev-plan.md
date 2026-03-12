# 개발 계획 — Claude 팀원 GUI

---

## 현재 상태

- CLI 스킬 3종 검증 완료 (`/meeting-multi`, `/meeting-agent`, `/meeting-team`)
- 팀원 프로필 8명 정의됨 + **2축 시스템 (연차+연봉) 완성**
- 개념 문서 정리 완료
- **Phase 0 확정 완료 → Phase 1 개발 시작 가능**

---

## 핵심 결정 사항 (확정됨 — 2026-03-12)

### 1. GUI가 에이전트를 어떻게 실행하는가?

**확정: Anthropic API 직접 호출 (옵션 A)**

```
VS Code Extension Host
  → Anthropic API (모델은 팀원별 연봉 등급에 따라 결정)
  → 병렬 API 호출 (선택된 에이전트 수만큼)
  → 스트리밍 결과 → Webview에 실시간 표시
```

### 2. 프레임워크

**확정: VS Code Extension (Webview Panel + React)**

| 검토 | 결과 |
|------|------|
| Electron | 오버킬 — 별도 앱 불필요, 보조툴 성격에 안 맞음 |
| Tauri | Rust 필요, 역시 별도 앱 |
| 웹앱 | 로컬 파일 접근 불가 |
| **VS Code Extension** | **채택** — 이미 VS Code 안에서 작업, 설치 부담 0 |

### 3. 데이터 모델

**확정: profiles.json (JSON 전환)**

- `meeting-team-profiles.md` → `profiles.json`으로 마이그레이션
- v1에서는 GUI 편집 UI 없이 JSON 파일 직접 수정
- v2에서 GUI 편집 UI 추가

> 상세 개발 계획은 [07-vscode-extension-plan.md](07-vscode-extension-plan.md) 참조

---

## 기능 범위 (v1)

### 팀원 관리
- [ ] 프로필 파일 읽기 (글로벌 / 프로젝트)
- [ ] 팀원 카드 표시 (이름, 직군, 성격 요약)
- [ ] 고용 / 해고 (회의 참여 인원 선택)
- [ ] 발령 (글로벌 ↔ 프로젝트 이동)
- [ ] 팀원 추가 / 수정 폼

### 회의 실행
- [ ] 회의 방식 선택 (multi / agent / team)
- [ ] 주제 입력
- [ ] 예상 토큰 비용 표시 (선택 인원 × 방식)
- [ ] 회의 실행 → 결과 스트리밍 표시
- [ ] 결과 저장 (MD or JSON)

### v2 이후 (보류)
- 회의 이력 관리
- 팀원 성과 추적
- 프리랜서 재계약 (resume)
- 다국어 지원

---

## 개발 단계

### Phase 0: 확정 (현재)
- [ ] 아키텍처 방식 결정 (API 직접 vs CLI 래핑)
- [ ] 프레임워크 결정 (Electron vs Tauri)
- [ ] 데이터 모델 확정 (MD vs JSON)

### Phase 1: 기반
- [ ] 프로젝트 세팅 (프레임워크 초기화)
- [ ] profiles.md 파서 구현
- [ ] Anthropic API 연동 (기본 호출 테스트)

### Phase 2: 팀원 관리 UI
- [ ] 팀원 카드 컴포넌트
- [ ] 고용/해고/발령 인터랙션
- [ ] 팀원 추가 폼

### Phase 3: 회의 실행
- [ ] 방식 선택 UI
- [ ] 토큰 비용 계산기
- [ ] API 병렬 호출 (agent / team 방식)
- [ ] 결과 표시 (스트리밍)

### Phase 4: 마무리
- [ ] 결과 저장/내보내기
- [ ] 오류 처리
- [ ] 패키징 / 배포

---

## 미결 사항

| 항목 | 상태 | 결정 필요 시점 |
|------|------|--------------|
| 아키텍처 방식 | ✅ API 직접 호출 | Phase 0 |
| 프레임워크 | ✅ VS Code Extension | Phase 0 |
| 데이터 모델 | ✅ profiles.json | Phase 0 |
| API 키 관리 방법 | ✅ VS Code SecretStorage | Phase 1 |
| 팀원 데이터 범위 | ✅ 워크스페이스 단위 (글로벌 없음) | Phase 0 |
