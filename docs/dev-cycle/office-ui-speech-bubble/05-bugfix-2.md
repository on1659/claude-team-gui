# 버그 수정 보고서: 오피스 UI + 말풍선 채팅 (사이클 #2)

╔══════════════════════════════════════════╗
║  개발 사이클: office-ui-speech-bubble      ║
║  현재 단계: 버그 수정 완료                  ║
║  반복: 2/3                                ║
╚══════════════════════════════════════════╝

## 수정 결과

| Bug ID | 심각도 | 상태 | 수정 파일 | 변경 내용 |
|--------|--------|------|---------|---------|
| T2-4 | CRITICAL | ✅ 수정 완료 | App.tsx | `useRef` + `useEffect([])` → callback ref 패턴으로 전환. DOM 노드 부착/탈착 시 자동으로 ResizeObserver 연결/해제 |
| T2-1 | MAJOR | ✅ 수정 완료 | App.tsx | `typeof ResizeObserver !== 'undefined'` 가드 추가 — 미지원 환경에서 graceful 폴백 (ChatLogPanel 숨김) |
| T2-3 | MAJOR | ✅ 수정 완료 | App.tsx | 초기 `panelWidth` 600 → 0으로 변경. 측정 전에는 ChatLogPanel 숨김, 첫 ResizeObserver 콜백에서 실제 너비 반영 |

## 수정 상세

### T2-4 + T2-1 + T2-3 통합 수정 (App.tsx)

**Before:**
```typescript
const [panelWidth, setPanelWidth] = useState(600);
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(...);
  ro.observe(el);
  return () => ro.disconnect();
}, []);  // ← 빈 의존성: idle 상태에서 ref null, observer 미생성
```

**After:**
```typescript
const [panelWidth, setPanelWidth] = useState(0);  // T2-3: 측정 전 숨김
const roRef = useRef<ResizeObserver | null>(null);

// Callback ref: DOM 노드 부착 시 자동 observer 연결 (T2-4 수정)
const containerRef = useCallback((node: HTMLDivElement | null) => {
  if (roRef.current) {
    roRef.current.disconnect();
    roRef.current = null;
  }
  if (node && typeof ResizeObserver !== 'undefined') {  // T2-1: 폴백 가드
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setPanelWidth(entry.contentRect.width);
      }
    });
    ro.observe(node);
    roRef.current = ro;
  }
}, []);

// Unmount cleanup
useEffect(() => {
  return () => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
  };
}, []);
```

**핵심 변경점:**
1. **Callback ref** — `useRef` 대신 `useCallback`으로 ref 함수 생성. React가 DOM 노드를 부착/탈착할 때마다 자동 호출 → idle→running 전환 시에도 정상 작동
2. **ResizeObserver 가드** — `typeof ResizeObserver !== 'undefined'` 조건으로 미지원 환경 방어
3. **초기값 0** — 측정 전 ChatLogPanel 숨김, 첫 콜백에서 실제 너비 반영

## 빌드 검증

- `tsc --noEmit`: ✅ 통과
- `npm run build`: ✅ 통과 (panel.js 21.07 kB gzip 6.00 kB)

## 미수정 항목 (MINOR → 잔여 개선 사항)

| Bug ID | 설명 | 사유 |
|--------|------|------|
| T2-2 | 리사이즈 시 불필요한 리렌더링 | ResizeObserver 자체가 rAF 배칭 제공, 실제 성능 영향 미미 |
| T2-5 | ChatLogPanel 리마운트 시 스크롤 위치 유실 | UX 개선 사항으로 다음 사이클 안건 |
