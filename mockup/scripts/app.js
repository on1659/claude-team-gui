// ============================================
// Claude Team GUI — Mockup Interaction Script
// ============================================

// --- 데이터 ---
let teamData = null;
let meetingData = null;

// --- 역할 → 아바타 클래스 매핑 ---
const ROLE_AVATAR = {
  PD: { class: 'pd', emoji: '🎯' },
  PLANNER_RESEARCH: { class: 'planner', emoji: '🔍' },
  PLANNER_STRATEGY: { class: 'planner', emoji: '📊' },
  BACKEND: { class: 'dev', emoji: '⚙️' },
  FRONTEND: { class: 'dev', emoji: '🖥️' },
  QA: { class: 'qa', emoji: '🧪' },
  UI: { class: 'design', emoji: '🎨' },
  UX: { class: 'design', emoji: '🧠' },
};

// --- 연봉 → 표시 매핑 ---
const SALARY_DISPLAY = {
  low: { label: '₩', model: 'Haiku' },
  medium: { label: '₩₩', model: 'Sonnet' },
  high: { label: '₩₩₩', model: 'Opus' },
};

// --- 상태 → 표시 매핑 ---
const STATUS_DISPLAY = {
  done: { label: '완료', dotClass: 'done' },
  streaming: { label: '응답 중', dotClass: 'streaming' },
  running: { label: '대기 중', dotClass: 'running' },
  error: { label: '오류', dotClass: 'error' },
  idle: { label: '대기', dotClass: 'idle' },
};

// --- 초기화 ---
async function init() {
  try {
    const [teamRes, meetingRes] = await Promise.all([
      fetch('../data/team.json'),
      fetch('../data/meeting.json'),
    ]);
    teamData = await teamRes.json();
    meetingData = await meetingRes.json();

    renderTeamList();
    renderMeetingPanel();
    updateCostEstimate();
  } catch (e) {
    console.error('데이터 로드 실패:', e);
  }
}

// --- 사이드바: 팀원 목록 렌더링 ---
function renderTeamList() {
  const container = document.getElementById('team-list');
  container.innerHTML = teamData.members
    .map((m) => {
      const avatar = ROLE_AVATAR[m.role] || { class: 'dev', emoji: '👤' };
      const salary = SALARY_DISPLAY[m.salary];
      const expPct =
        m.experienceLevel === 'junior'
          ? 15
          : m.experienceLevel === 'mid'
            ? 40
            : m.experienceLevel === 'senior'
              ? 70
              : 100;

      return `
      <div class="member-card ${m.active ? 'selected' : 'inactive'}" data-id="${m.id}" onclick="toggleMember('${m.id}')">
        <div class="member-check">
          <input type="checkbox" ${m.active ? 'checked' : ''} onclick="event.stopPropagation(); toggleMember('${m.id}')">
        </div>
        <div class="pixel-avatar">${renderPixelAvatar(m.id, 36)}</div>
        <div class="member-info">
          <div class="member-name-row">
            <span class="member-name">${m.name}</span>
            <span class="member-role">${m.roleLabel}</span>
          </div>
          <div class="member-meta">
            <div class="exp-bar">
              <span class="exp-level ${m.experienceLevel}">${m.experienceLevel}</span>
              <div class="exp-bar-track">
                <div class="exp-bar-fill ${m.experienceLevel}" style="width: ${expPct}%"></div>
              </div>
              <span class="exp-bar-label">${m.experience}y</span>
            </div>
            <span class="salary-badge ${m.salary}">${salary.label} ${salary.model}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// --- 팀원 토글 ---
function toggleMember(id) {
  const member = teamData.members.find((m) => m.id === id);
  if (member) {
    member.active = !member.active;
    renderTeamList();
    updateCostEstimate();
  }
}

// --- 비용 계산 ---
function updateCostEstimate() {
  const active = teamData.members.filter((m) => m.active);
  const total = teamData.members.length;

  // 모델별 토큰 추정 (input + output per agent)
  const TOKEN_COST = { low: 1200, medium: 2100, high: 3200 };
  const USD_PER_TOKEN = { low: 0.000001, medium: 0.000006, high: 0.00003 };

  let tokens = 0;
  let usd = 0;
  active.forEach((m) => {
    tokens += TOKEN_COST[m.salary];
    usd += TOKEN_COST[m.salary] * USD_PER_TOKEN[m.salary];
  });

  document.getElementById('participant-count').textContent =
    `${active.length}/${total}명`;
  document.getElementById('estimated-cost').textContent =
    `~${tokens.toLocaleString()} 토큰`;
  document.getElementById('estimated-price').textContent =
    `~$${usd.toFixed(2)}`;
}

// --- 회의 패널 렌더링 ---
function renderMeetingPanel() {
  const grid = document.getElementById('agent-grid');

  grid.innerHTML = meetingData.responses
    .map((r) => {
      const avatar = ROLE_AVATAR[r.role] || { class: 'dev', emoji: '👤' };
      const status = STATUS_DISPLAY[r.status] || STATUS_DISPLAY.idle;
      const isStreaming = r.status === 'streaming';
      const isRunning = r.status === 'running';
      const isEmpty = !r.content;

      // 간단 마크다운 → HTML 변환
      let html = r.content || '';
      // bold
      html = html.replace(/\*\*\[([^\]]+)\]\*\*/g, '<strong>[$1]</strong>');
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // inline code
      html = html.replace(
        /`([^`]+)`/g,
        '<code>$1</code>'
      );
      // code blocks
      html = html.replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        '<pre>$2</pre>'
      );
      // newlines
      html = html.replace(/\n/g, '<br>');

      const cursor = isStreaming
        ? '<span class="streaming-cursor"></span>'
        : '';

      return `
      <div class="agent-card ${r.status}">
        <div class="agent-header">
          <div class="pixel-avatar">${renderPixelAvatar(r.memberId, 32)}</div>
          <div class="agent-info">
            <div class="agent-name">${r.name}</div>
            <div class="agent-detail">
              <span>${r.experienceLevel}</span>
              <span>·</span>
              <span>${r.model}</span>
            </div>
          </div>
          <div class="agent-status">
            <span class="status-dot ${status.dotClass}"></span>
            <span>${status.label}</span>
          </div>
        </div>
        <div class="agent-content ${isEmpty ? 'empty' : ''}">
          ${isEmpty ? '응답 대기 중...' : html + cursor}
        </div>
        ${
          r.status === 'done'
            ? `<div class="agent-footer">
                <span>~2,100 토큰</span>
                <span>12.3초</span>
              </div>`
            : ''
        }
      </div>
    `;
    })
    .join('');
}

// --- 섹션 토글 ---
function toggleSection(header) {
  header.classList.toggle('collapsed');
  const content = header.nextElementSibling;
  content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

// --- 회의 모드 선택 ---
document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('.mode-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- 회의 시작 (시뮬레이션) ---
function startMeeting() {
  const btn = document.getElementById('start-btn');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
    진행 중...
  `;
  btn.style.background = '#d97706';

  // 시뮬레이션: 3초 후 완료 상태로 전환
  simulateProgress();
}

function simulateProgress() {
  const responses = meetingData.responses;
  let completed = responses.filter((r) => r.status === 'done').length;
  const total = responses.length;

  // 스트리밍 중인 에이전트 완료 처리
  const streamingIdx = responses.findIndex((r) => r.status === 'streaming');
  if (streamingIdx >= 0) {
    setTimeout(() => {
      responses[streamingIdx].status = 'done';
      responses[streamingIdx].content += '\n\n(분석 완료)';
      completed++;
      updateProgress(completed, total);
      renderMeetingPanel();

      // 다음 running → streaming
      const runningIdx = responses.findIndex((r) => r.status === 'running');
      if (runningIdx >= 0) {
        setTimeout(() => {
          responses[runningIdx].status = 'streaming';
          responses[runningIdx].content =
            '**디자인 토큰 체계:**\n\nVS Code 테마 변수를 Primitive 토큰으로 매핑하는 방식 제안:\n\n- `--vscode-editor-background` → `color.bg.primary`\n- `--vscode-foreground` → `color.text.primary`\n\n카드 컴포넌트 상태별 보더 색상:\n- default: `var(--vscode-border)`\n- done: `rgba(78, 201, 176, 0.3)` → semantic: `color.status.success`\n- streaming: `rgba(0, 122, 204, 0.5)` → semantic: `color.status.active`';
          renderMeetingPanel();

          // 최종 완료
          setTimeout(() => {
            responses[runningIdx].status = 'done';
            completed++;
            updateProgress(completed, total);
            renderMeetingPanel();

            // 나머지 스트리밍도 완료
            const remaining = responses.filter(
              (r) => r.status === 'streaming'
            );
            remaining.forEach((r, i) => {
              setTimeout(() => {
                r.status = 'done';
                r.content += '\n\n(분석 완료)';
                completed++;
                updateProgress(completed, total);
                renderMeetingPanel();

                if (completed >= total) {
                  finishMeeting();
                }
              }, (i + 1) * 1500);
            });

            if (remaining.length === 0 && completed >= total) {
              finishMeeting();
            }
          }, 3000);
        }, 1000);
      }
    }, 2000);
  }
}

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  document.getElementById('progress-label').textContent = `${done}/${total} 완료`;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function finishMeeting() {
  // 상태 업데이트
  const statusBadge = document.querySelector('.meta-badge.status');
  statusBadge.className = 'meta-badge status done';
  statusBadge.textContent = '완료';

  // 버튼 업데이트
  const btn = document.getElementById('start-btn');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    완료!
  `;
  btn.style.background = '#047857';

  // 하단 버튼 활성화
  document.getElementById('btn-copy').disabled = false;
  document.getElementById('btn-save').disabled = false;
  document.getElementById('btn-new').disabled = false;

  // 요약 패널 표시
  const summary = document.getElementById('summary-panel');
  summary.style.display = 'block';
  document.getElementById('summary-content').innerHTML = `
    <strong>전원 합의 사항:</strong><br>
    • VS Code Extension + Webview 아키텍처 적합 — 보조툴 성격에 최적<br>
    • Phase 3 (회의 실행)이 크리티컬 패스 — 8명 병렬 스트리밍 + 에러 핸들링 집중<br>
    • API 키는 Extension Host에서만 관리, Webview 노출 절대 금지<br>
    • v1은 meeting-team 집중, 나머지 방식은 v2<br>
    <br>
    <strong>미결 사항:</strong><br>
    • 글로벌 팀원 경로(~/.claude/) — VS Code globalStorageUri 충돌 확인 필요<br>
    • 8명 동시 API 요청 시 rate limit — stagger 전략 구체화 필요<br>
    <br>
    <strong>비용:</strong> 총 ~18,100 토큰 · $0.12 · 38초
  `;
}

function cancelMeeting() {
  if (confirm('진행 중인 회의를 중단하시겠습니까?')) {
    location.reload();
  }
}

// --- 실행 ---
init();
