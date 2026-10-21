// 화면 연결 — 서버(실시간 Claude/시뮬레이션)에 붙고, 서버가 없으면 브라우저 안에서 데모 엔진을 돌린다.
import { Office } from './render.js';
import { FLOORS } from './map.js';
import { createEngine } from './engine.js';
import { createSimRunner } from './sim-runner.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

const STATUS = { idle: '쉬는 중', working: '일하는 중', meeting: '회의 중', waiting: '대표님 답 대기', chatting: '수다 중' };
const TSTATUS = {
  queued: '대기', planning: '기획 중', meeting: '킥오프', in_progress: '진행', waiting: '질문 대기', review_wait: '검수 대기',
  review: '검수 중', confirm_wait: '컨펌 대기', confirm: '대표 컨펌', wiki_wait: '기록 대기', wiki: '기록 중', done: '완료', failed: '실패',
};
const COLS = [
  ['대기', ['queued', 'planning', 'meeting']],
  ['진행', ['in_progress', 'waiting']],
  ['검수·컨펌', ['review_wait', 'review', 'confirm_wait', 'confirm', 'wiki_wait', 'wiki']],
  ['완료', ['done', 'failed']],
];

const WORK_ROLES = ['researcher', 'docs', 'designer', 'frontend', 'backend'];

const office = new Office($('office'));
let S = null;
let api = null;
let tab = 'office';
let qKey = '';

// ---------- 연결 ----------
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function connect() {
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no server');
    onSnap(await r.json());
    const es = new EventSource('api/events');
    es.onmessage = (e) => onSnap(JSON.parse(e.data));
    api = {
      addTask: (title, detail) => post('api/tasks', { title, detail }),
      answer: (id, text) => post(`api/questions/${id}/answer`, { text }),
      decide: (id, approve, comment) => post(`api/approvals/${id}`, { approve, comment }),
      assign: (agentId, title, detail) => post('api/assign', { agentId, title, detail }),
      demo: () => post('api/demo', {}),
    };
  } catch {
    const engine = createEngine({ runner: createSimRunner(), mode: 'demo', maxParallel: 3, autoDemo: true, autoAnswerMs: 60e3 });
    api = {
      addTask: (t, d) => engine.addTask(t, d), answer: (id, t) => engine.answer(id, t), demo: () => engine.demoTask(),
      decide: (id, ok, c) => engine.decide(id, ok, c), assign: (a, t, d) => engine.assign(a, t, d),
    };
    engine.subscribe(onSnap);
  }
}

function onSnap(snap) {
  const skew = Date.now() - snap.now;
  for (const a of snap.agents) if (a.say) a.say.at += skew;
  S = snap;
  office.sync(snap.agents);
  render();
}

// ---------- 그리기 루프 ----------
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  office.update(dt, Date.now());
  if (tab === 'office') office.draw(Date.now());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 패널 ----------
const agent = (id) => S?.agents.find((a) => a.id === id);
const task = (id) => S?.tasks.find((t) => t.id === id);

function render() {
  if (!S) return;
  const m = S.metrics;
  $('modeChip').textContent = S.mode === 'claude' ? '실시간 · Claude' : S.mode === 'demo' ? '데모 · 브라우저' : '시뮬레이션';
  $('modeChip').classList.toggle('demo', S.mode !== 'claude');
  $('topStats').innerHTML = `열린 레인 ${m.lanes} · 워커 ${m.workers} · 막힘 ${m.blocked}` +
    (S.mode === 'claude' ? `<span class="cost">누적 $${S.costUsd.toFixed(2)}</span>` : '');
  $('leftSub').textContent = `열린 레인 ${m.lanes} · 완료 ${m.done} · 일감 ${S.tasks.filter((t) => !t.parentId).length}`;
  $('footL').textContent = `대표님 기다림 ${m.ceoWaiting}건 · 진행 하위 일감 ${S.tasks.filter((t) => t.parentId && t.status === 'in_progress').length}건`;
  $('footR').textContent = S.mode === 'claude' ? '도구 호출 = 방 이동' : '데모 데이터 · 실제 Claude 아님';

  renderFloors();
  renderQuestions();
  renderPeople();
  renderLogs();
  renderMeeting();
  renderPop();
  $('trio').innerHTML = [['안 닫힌 후보', m.openCandidates], ['묻힌 일', m.buried], ['진행 안 된 일', m.stalled]]
    .map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
  if (tab === 'board') renderBoard();
  if (tab === 'minutes') renderMinutes();
  if (tab === 'wiki') renderWiki();
}

function renderFloors() {
  const counts = office.floorCounts();
  const openQ = S?.metrics.ceoWaiting || 0;
  $('floors').innerHTML = [3, 2, 1].map((n) => {
    const badge = n === 3 ? `${openQ}` : `${counts[n]}명`;
    const zero = n === 3 ? !openQ : !counts[n];
    return `<button class="floor-btn ${office.floor === n ? 'on' : ''}" data-floor="${n}">
      <span class="fl">${n}F</span><span class="nm">${FLOORS[n].name}</span><span class="ct ${zero ? 'zero' : ''}">${badge}</span></button>`;
  }).join('');
  $('curFloor').innerHTML = `<b>${office.floor}F</b><small>현재 층</small>`;
  $('floorTitle').textContent = `${office.floor}F ${FLOORS[office.floor].name}`;
}
setInterval(() => S && renderFloors(), 700);

function fileLink(f) {
  const name = esc(f.split('/').slice(1).join('/') || f);
  return S.mode === 'claude' ? `<a href="files/${f.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener">${name}</a>` : `<span>${name}</span>`;
}

function renderQuestions() {
  const open = S.questions.filter((q) => q.status === 'open');
  const aps = S.approvals.filter((x) => x.status === 'open');
  $('qCount').textContent = `${open.length + aps.length}건`;
  const key = [...open, ...aps].map((q) => q.id).join(',');
  if (key === qKey) return;
  qKey = key;
  const confirmCards = aps.map((ap) => {
    const a = agent(ap.agentId), t = task(ap.taskId);
    return `<div class="q confirm"><div class="who"><span class="dot" style="background:${a.color}"></span>${esc(a.name)} · 컨펌 요청${ap.round > 1 ? ` (${ap.round}차)` : ''}<small>${esc(t?.id)} · ${hhmm(ap.createdAt)}</small></div>
      <p><b>${esc(t?.title)}</b><br>${esc(ap.summary)}</p>
      ${ap.files.length ? `<div class="files">📎 ${ap.files.map(fileLink).join('')}</div>` : ''}
      <form data-ap="${ap.id}"><input placeholder="수정 요청 시 코멘트"><button type="button" class="ghost" data-act="changes">수정 요청</button><button type="button" data-act="approve">승인</button></form></div>`;
  });
  const questionCards = open.map((q) => {
    const a = agent(q.agentId), t = task(q.taskId);
    return `<div class="q"><div class="who"><span class="dot" style="background:${a.color}"></span>${esc(a.name)} · 질문<small>${esc(t?.id)} · ${hhmm(q.createdAt)}</small></div>
      <p>${esc(q.text)}</p>
      <form data-q="${q.id}"><input placeholder="답변을 적어 주세요" required><button>답하기</button></form></div>`;
  });
  $('questions').innerHTML = confirmCards.length + questionCards.length ? [...confirmCards, ...questionCards].join('') : '<p class="muted">대표님께 온 질문·컨펌 없음</p>';
}

function renderPeople() {
  $('peopleN').textContent = `${S.agents.length}명`;
  $('people').innerHTML = S.agents.map((a) => `<li data-agent="${a.id}">
    <span class="dot" style="background:${a.color}"></span><b>${esc(a.name)}</b><span class="role">${esc(a.title)}</span>
    <span class="st">${a.floor}F ${esc(a.room)} · ${STATUS[a.status] || a.status}</span></li>`).join('');
}

function renderLogs() {
  $('logs').innerHTML = S.logs.slice(0, 60).map((l) => {
    const a = agent(l.agentId);
    return `<li><time>${hhmm(l.at)}</time><div><span class="who" style="color:${a?.color || '#555'}">${esc(a?.name || '시스템')}</span> ${esc(l.text)}
      ${l.taskId ? `<span class="tid">#${esc(l.taskId)}</span>` : ''}</div></li>`;
  }).join('');
}

function renderMeeting() {
  const m = S.meeting;
  const el = $('meeting');
  if (!m || tab !== 'office') { el.hidden = true; return; }
  el.hidden = false;
  const lines = m.lines.slice(-4);
  el.innerHTML = `<h4>🗣 ${esc(m.topic)} ${office.floor !== 1 ? '<button data-floor="1">회의실 보기</button>' : ''}</h4>
    <p class="muted">${m.participants.map((id) => esc(agent(id)?.name)).join(', ')} · ${m.status === 'gathering' ? '모이는 중…' : '회의 중'}</p>
    <ul>${lines.map((l) => `<li><b style="color:${agent(l.agentId)?.color}">${esc(agent(l.agentId)?.name)}</b>${esc(l.text)}</li>`).join('')}</ul>`;
}

function renderPop() {
  const el = $('pop');
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const a = office.selected && agent(office.selected);
  if (!a || tab !== 'office') { el.hidden = true; return; }
  const t = a.taskId && task(a.taskId);
  const logs = S.logs.filter((l) => l.agentId === a.id).slice(0, 4);
  el.hidden = false;
  el.innerHTML = `<h4><span class="dot" style="background:${a.color}"></span>${esc(a.name)} <small class="muted">${esc(a.title)}</small><button class="x" data-close>×</button></h4>
    <dl><dt>상태</dt><dd>${STATUS[a.status] || a.status}</dd><dt>위치</dt><dd>${a.floor}F ${esc(a.room)}</dd>
    <dt>하는 일</dt><dd>${esc(a.activity || '-')}</dd><dt>일감</dt><dd>${t ? `${esc(t.id)} ${esc(t.title)}` : '-'}</dd></dl>
    ${logs.length ? `<ul>${logs.map((l) => `<li>${hhmm(l.at)} ${esc(l.text)}</li>`).join('')}</ul>` : ''}
    ${WORK_ROLES.includes(a.role) ? `<form class="direct" data-assign="${a.id}"><input placeholder="${esc(a.name)}에게 바로 시키기" required maxlength="80"><button>지시</button></form>
      ${a.busy ? '<p class="muted">지금 하는 일이 끝나면 시작해요</p>' : ''}` : ''}`;
}

function renderBoard() {
  const tops = S.tasks.filter((t) => !t.parentId).slice().reverse();
  $('board').innerHTML = tops.length ? `<div class="board">${COLS.map(([name, sts]) => {
    const items = tops.filter((t) => sts.includes(t.status));
    return `<div class="col"><h4>${name}<span>${items.length}</span></h4>${items.map((t) => {
      const ks = S.tasks.filter((k) => k.parentId === t.id);
      const tags = [t.direct ? `직접 지시 → ${agent(t.direct)?.name}` : '', t.headcount ? `${t.headcount}명` : '', t.files?.length ? `파일 ${t.files.length}` : ''].filter(Boolean).join(' · ');
      return `<div class="tcard"><div class="tt">${esc(t.title)}</div><div class="meta">${esc(t.id)} · ${TSTATUS[t.status]} · ${hhmm(t.createdAt)}${tags ? ` · ${esc(tags)}` : ''}</div>
        <ul>${ks.map((k) => `<li><span class="dot" style="background:${agent(k.assignee)?.color}"></span>${esc(agent(k.assignee)?.name)} · ${esc(k.title)}<span class="st">${k.status === 'queued' && k.after?.length ? '순서 대기' : TSTATUS[k.status]}</span></li>`).join('')}</ul></div>`;
    }).join('')}</div>`;
  }).join('')}</div>` : '<p class="empty">아직 일감이 없어요. 오른쪽에서 일감을 시켜 보세요.</p>';
}

function renderMinutes() {
  const list = [...(S.meeting ? [S.meeting] : []), ...S.minutes];
  $('minutes').innerHTML = list.length ? list.map((m) => `<div class="minute"><h4>${esc(m.topic)}</h4>
    <div class="meta">${hhmm(m.startedAt)} · ${m.participants.map((id) => esc(agent(id)?.name)).join(', ')}${m.endedAt ? '' : ' · 진행 중'}</div>
    <ul>${m.lines.map((l) => `<li><b style="color:${agent(l.agentId)?.color}">${esc(agent(l.agentId)?.name)}</b> ${esc(l.text)}</li>`).join('')}</ul></div>`).join('')
    : '<p class="empty">아직 열린 회의가 없어요.</p>';
}

function renderWiki() {
  $('wiki').innerHTML = S.wiki.length ? S.wiki.map((w) => `<div class="wiki-item"><h4>📚 ${esc(w.title)}</h4>
    <div class="meta">${esc(w.path)} · ${hhmm(w.at)}</div><p>${esc(w.summary)}</p>
    ${w.files?.length ? `<div class="files">📎 ${w.files.map(fileLink).join('')}</div>` : ''}</div>`).join('')
    : '<p class="empty">손글씨가 정리한 위키 문서가 여기에 쌓여요.</p>';
}

// ---------- 입력 ----------
document.addEventListener('click', (e) => {
  const fl = e.target.closest('[data-floor]');
  if (fl) { office.setFloor(fl.dataset.floor); setTab('office'); renderFloors(); renderMeeting(); return; }
  const li = e.target.closest('[data-agent]');
  if (li) { const a = agent(li.dataset.agent); office.selected = a.id; office.setFloor(a.floor); setTab('office'); render(); return; }
  if (e.target.closest('[data-close]')) { office.selected = null; renderPop(); }
});

$('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
function setTab(t) {
  tab = t;
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === t);
  $('stage').hidden = t !== 'office';
  $('hint').hidden = t !== 'office';
  for (const id of ['board', 'minutes', 'wiki']) $(id).hidden = t !== id;
  render();
}

const canvas = $('office');
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  office.hover = office.hit(e.clientX - r.left, e.clientY - r.top);
  canvas.style.cursor = office.hover ? 'pointer' : 'default';
});
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  office.selected = office.hit(e.clientX - r.left, e.clientY - r.top);
  renderPop();
});

$('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api.addTask($('taskTitle').value, $('taskDetail').value);
  $('taskTitle').value = ''; $('taskDetail').value = '';
});
$('demoBtn').addEventListener('click', () => api.demo());
$('questions').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const f = b.closest('form[data-ap]');
  const comment = f.querySelector('input').value.trim();
  if (b.dataset.act === 'changes' && !comment) { f.querySelector('input').focus(); f.querySelector('input').placeholder = '무엇을 고칠지 적어 주세요'; return; }
  qKey = '';
  await api.decide(f.dataset.ap, b.dataset.act === 'approve', comment);
});
$('pop').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.closest('form[data-assign]');
  const input = f.querySelector('input');
  await api.assign(f.dataset.assign, input.value, '');
  input.value = '';
  input.blur();
  renderPop();
});
$('questions').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.closest('form[data-q]');
  if (!f) return;
  const text = f.querySelector('input').value;
  qKey = '';
  await api.answer(f.dataset.q, text);
});

setInterval(() => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  $('clock').textContent = `관측 ${d.getMonth() + 1}. ${d.getDate()}. ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}, 1000);

connect();
