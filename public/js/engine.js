// 사무실 오케스트레이터 — 브라우저(데모)와 Node(실제 Claude) 양쪽에서 그대로 쓴다.
// 화면 좌표는 모르고 "몇 층, 어느 방, 무슨 일" 까지만 상태로 관리한다.

export const AGENTS = [
  { id: 'maro', name: '마로', role: 'pm', title: 'PM·관제', color: '#e8833a', hair: '#5a3a22', homeFloor: 1, homeRoom: '로비' },
  { id: 'hangyeol', name: '한결', role: 'backend', title: '백엔드', color: '#3b7be0', hair: '#26221f', homeFloor: 1, homeRoom: '업무석' },
  { id: 'daon', name: '다온', role: 'frontend', title: '프론트엔드', color: '#22a37f', hair: '#7a4a2a', homeFloor: 1, homeRoom: '업무석' },
  { id: 'bora', name: '보라', role: 'designer', title: '디자이너', color: '#9b5de0', hair: '#3a2546', homeFloor: 1, homeRoom: '업무석' },
  { id: 'geom', name: '검이', role: 'qa', title: 'QA·검수', color: '#e0566a', hair: '#1f1f1f', homeFloor: 1, homeRoom: '업무석' },
  { id: 'sonul', name: '손글씨', role: 'writer', title: '위키 기록', color: '#d39b16', hair: '#4a3322', homeFloor: 2, homeRoom: '집필실' },
];

export const WORK_ROLES = ['backend', 'frontend', 'designer'];

const SYSTEM = {
  pm: "당신은 'AI 사무실'의 PM 겸 관제 담당 '마로'입니다. 대표님 요청을 이해하고 팀원 역할에 맞게 일을 나눕니다.",
  backend: "당신은 'AI 사무실'의 백엔드 개발자 '한결'입니다. API, 데이터, 스크립트, 서버 로직을 맡습니다.",
  frontend: "당신은 'AI 사무실'의 프론트엔드 개발자 '다온'입니다. 화면, 컴포넌트, 웹 페이지를 맡습니다.",
  designer: "당신은 'AI 사무실'의 디자이너 '보라'입니다. 시안은 HTML/CSS, SVG, 디자인 토큰 파일처럼 코드로 남깁니다.",
  qa: "당신은 'AI 사무실'의 QA '검이'입니다. 결과물을 읽고 실행해 보며 검수합니다. 파일은 수정하지 않습니다.",
  writer: "당신은 'AI 사무실'의 위키 기록 담당 '손글씨'입니다. 끝난 일을 다른 사람이 이해할 수 있게 문서로 남깁니다.",
};

const WORK_RULES = `
규칙:
- 작업은 현재 폴더 안에서만 하세요. 같은 일감의 다른 팀원도 이 폴더를 함께 씁니다.
- 결과물은 반드시 파일로 남기세요.
- 대표님 결정이 꼭 필요하면 작업을 멈추고 마지막 답변을 "[질문] 질문 내용" 한 줄로 끝내세요. 사소한 건 스스로 판단하세요.
- 끝나면 한 일을 3줄 이내 한국어로 요약하세요.`;

const SMALLTALK = [
  ['어제 배포 잘 됐어요?', '네, 롤백 없이 깔끔했어요 👍'],
  ['점심 뭐 먹을래요?', '국밥 어때요?', '좋아요 🍲'],
  ['이번 스프린트 빡세네요', '그래도 거의 다 왔어요 💪'],
  ['커피 머신 고쳐졌대요', '오 드디어!'],
  ['대표님 오늘 기분 좋아 보이시던데', '보고 타이밍이다…'],
  ['그 버그 원인 찾았어요?', '캐시였어요. 역시 캐시…', '항상 캐시죠 😇'],
  ['새 모니터 받았어요?', '27인치! 눈이 편해요'],
];

const DEMO_TASKS = [
  ['우리집 가전 관리 페이지에 필터 청소 알림 추가', '세탁기·에어컨 필터 청소 주기를 계산해서 다가오는 일정을 보여주는 기능'],
  ['사무실 소개 랜딩 페이지 만들기', '팀원 소개와 하는 일을 보여주는 한 페이지짜리 랜딩'],
  ['가계부 CSV 정리 스크립트', '카드사 CSV를 읽어 월별·카테고리별 합계를 내는 스크립트'],
  ['로그인 화면 리디자인', '모바일에서 보기 좋은 로그인 화면 시안과 구현'],
  ['주간 날씨 알림 봇', '매주 월요일 날씨 요약을 만들어 주는 간단한 API'],
];

const OPEN = ['queued', 'planning', 'meeting', 'in_progress', 'review_wait', 'review', 'wiki_wait', 'wiki', 'waiting'];
const BURIED_MS = 3 * 60e3;
const STALL_MS = 4 * 60e3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const base = (p) => String(p ?? '').split(/[\\/]/).filter(Boolean).pop() || '';

export function parseJson(text) {
  if (!text) return null;
  const s = String(text).replace(/```(?:json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// 도구 이름 → 캐릭터가 가 있을 방
export function toolPlace(agent, name, input = {}) {
  const desk = { floor: agent.homeFloor, room: agent.homeRoom };
  const lib = agent.homeFloor === 2 ? { floor: 2, room: '위키 서고' } : { floor: 1, room: '자료실' };
  const reading = ['Read', 'Glob', 'Grep', 'LS'].includes(name);
  if (agent.role === 'qa' && reading) return { floor: 1, room: '검수실', act: `검토 · ${clip(base(input.file_path || input.pattern || input.path), 18)}` };
  if (reading) return { ...lib, act: `자료 찾기 · ${clip(base(input.file_path || input.pattern || input.path), 18)}` };
  if (name === 'WebSearch') return { floor: 1, room: '정보검색실', act: `검색 · ${clip(input.query, 16)}` };
  if (name === 'WebFetch') {
    let host = ''; try { host = new URL(input.url).host; } catch {}
    return { floor: 1, room: '정보검색실', act: `웹 읽기 · ${clip(host, 18)}` };
  }
  if (['Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(name)) return { ...desk, act: `작성 · ${clip(base(input.file_path), 18)}` };
  if (name === 'Bash') {
    const cmd = String(input.command || '').trim();
    const words = cmd.split(/\s+/);
    if (/^git\b/.test(cmd)) return { floor: 1, room: '서버실', act: `명령 · git ${words[1] || ''}`.trim() };
    if (/\b(test|jest|vitest|pytest|lint)\b/.test(cmd)) return { floor: 1, room: '검수실', act: `테스트 · ${clip(cmd, 16)}` };
    return { floor: 1, room: '서버실', act: `명령 · ${clip(words[0], 14)}` };
  }
  if (name === 'TodoWrite') return { ...desk, act: '할 일 정리' };
  if (name === 'Task' || name === 'Agent') return { floor: 1, room: '회의실', act: '협업 요청' };
  return { ...desk, act: clip(name, 16) };
}

export function createEngine({ runner, mode = 'sim', maxParallel = 2, autoDemo = false, autoAnswerMs = 0 } = {}) {
  const listeners = new Set();
  const state = {
    mode,
    runner: runner?.name || mode,
    startedAt: Date.now(),
    seq: 0,
    costUsd: 0,
    agents: AGENTS.map((a) => ({
      ...a, status: 'idle', floor: a.homeFloor, room: a.homeRoom, activity: '', taskId: null,
      say: null, busy: false, chatting: false, lastEventAt: Date.now(), nextWanderAt: Date.now() + rand(4e3, 15e3),
    })),
    tasks: [],
    questions: [],
    meeting: null,
    minutes: [],
    logs: [],
    wiki: [],
  };
  let activeRuns = 0;
  let notifyTimer = null;
  let lastTaskAt = Date.now() - 30e3;
  let meetingChain = Promise.resolve();

  const A = (id) => state.agents.find((a) => a.id === id);
  const byRole = (role) => state.agents.find((a) => a.role === role);
  const T = (id) => state.tasks.find((t) => t.id === id);
  const kids = (top) => state.tasks.filter((t) => t.parentId === top.id);
  const nextId = (p) => `${p}-${String(++state.seq).padStart(3, '0')}`;
  const resolveSpeaker = (k) => A(k) || byRole(k) || state.agents.find((a) => a.name === k);

  function changed() {
    if (notifyTimer) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      const snap = snapshot();
      for (const fn of listeners) fn(snap);
    }, 120);
  }

  function log(agentId, text, taskId = null, kind = 'info') {
    state.logs.unshift({ id: ++state.seq, at: Date.now(), agentId, text, taskId, kind });
    state.logs.length = Math.min(state.logs.length, 200);
    changed();
  }

  function setAgent(a, patch) {
    Object.assign(a, patch, { lastEventAt: Date.now() });
    changed();
  }

  function say(a, text, ms) {
    a.say = { text: clip(text, 80), at: Date.now(), ms: ms ?? Math.min(6000, Math.max(2600, 1600 + String(text).length * 70)) };
    changed();
  }

  function goHome(a, patch = {}) {
    setAgent(a, { status: 'idle', floor: a.homeFloor, room: a.homeRoom, activity: '', taskId: null, ...patch });
  }

  function touch(task) { task.updatedAt = Date.now(); }

  // ---------- 러너 호출 ----------
  async function run(agent, task, opts) {
    activeRuns++;
    let lastSay = 0;
    try {
      const res = await runner.run({
        ...opts,
        agent: { id: agent.id, name: agent.name, role: agent.role, title: agent.title },
        systemPrompt: SYSTEM[agent.role] + (opts.kind === 'work' ? WORK_RULES : ''),
        onEvent: (ev) => {
          touch(task);
          if (ev.type === 'tool') {
            const p = toolPlace(agent, ev.name, ev.input);
            setAgent(agent, { floor: p.floor, room: p.room, activity: p.act });
            log(agent.id, p.act, task.id, 'tool');
          } else if (ev.type === 'text' && opts.kind === 'work' && ev.text && Date.now() - lastSay > 6000) {
            lastSay = Date.now();
            say(agent, clip(ev.text, 60));
          }
        },
      });
      if (res.costUsd) state.costUsd += res.costUsd;
      return res;
    } catch (e) {
      return { text: String(e?.message || e), isError: true };
    } finally {
      activeRuns--;
    }
  }

  // ---------- 회의 ----------
  function holdMeeting(opts) {
    const p = meetingChain.then(() => runMeeting(opts));
    meetingChain = p.catch(() => {});
    return p;
  }

  async function runMeeting({ topic, taskId, ownerIds, inviteIds = [], lines }) {
    const invited = [...new Set(inviteIds)].filter((id) => !ownerIds.includes(id)).map(A).filter((a) => a && !a.busy);
    invited.forEach((a) => { a.busy = true; a.chatting = false; });
    const people = [...ownerIds.map(A), ...invited];
    const farAway = people.some((a) => a.floor !== 1);
    people.forEach((a) => setAgent(a, { status: 'meeting', floor: 1, room: '회의실', activity: `회의 · ${clip(topic, 14)}` }));
    state.meeting = { id: nextId('M'), topic, taskId, participants: people.map((a) => a.id), lines: [], status: 'gathering', startedAt: Date.now() };
    log(people[0].id, `회의 소집 · ${topic}`, taskId, 'meeting');
    await sleep(farAway ? 11000 : 6500);
    state.meeting.status = 'talking';
    changed();
    for (const line of lines || []) {
      const sp = resolveSpeaker(line.speaker);
      if (!sp || !state.meeting.participants.includes(sp.id)) continue;
      const text = clip(line.line ?? line.text, 90);
      state.meeting.lines.push({ agentId: sp.id, text, at: Date.now() });
      say(sp, text);
      await sleep(Math.min(6000, Math.max(2600, 1600 + text.length * 70)));
    }
    state.minutes.unshift({ ...state.meeting, status: 'done', endedAt: Date.now() });
    state.minutes.length = Math.min(state.minutes.length, 20);
    state.meeting = null;
    invited.forEach((a) => { a.busy = false; goHome(a); });
    changed();
  }

  // ---------- 1) 기획 ----------
  async function planTask(t) {
    const pm = A('maro');
    pm.busy = true;
    pm.chatting = false;
    t.status = 'planning';
    touch(t);
    setAgent(pm, { status: 'working', floor: 1, room: '회의실', activity: `기획 · ${clip(t.title, 14)}`, taskId: t.id });
    say(pm, '새 일감 들어왔어요! 쪼개 볼게요 📝');
    log('maro', `일감 접수 · ${t.title}`, t.id);

    const res = await run(pm, t, { kind: 'plan', prompt: planPrompt(t), workdir: t.id });
    const plan = parseJson(res.text) || {};
    let subs = (Array.isArray(plan.subtasks) ? plan.subtasks : [])
      .filter((s) => WORK_ROLES.includes(s?.role) && s.title)
      .slice(0, 4);
    if (!subs.length) subs = [{ role: 'backend', title: clip(t.title, 30), detail: t.detail || t.title }];
    t.summary = clip(plan.summary || t.title, 120);

    t.status = 'meeting';
    touch(t);
    const lines = Array.isArray(plan.meeting) && plan.meeting.length ? plan.meeting : kickoffLines(t, subs);
    await holdMeeting({
      topic: `킥오프 · ${clip(t.title, 18)}`, taskId: t.id, ownerIds: ['maro'],
      inviteIds: subs.map((s) => byRole(s.role).id).concat('geom'), lines,
    });

    for (const s of subs) addSubtask(t, s);
    t.status = 'in_progress';
    touch(t);
    pm.busy = false;
    goHome(pm);
    pump();
  }

  function addSubtask(top, s, fix = false) {
    const sub = {
      id: nextId('T'), parentId: top.id, role: s.role, title: clip(s.title, 40), detail: String(s.detail || ''),
      assignee: byRole(s.role).id, status: 'queued', fix, createdAt: Date.now(), updatedAt: Date.now(),
      sessionId: null, result: '', questionsAsked: 0,
    };
    state.tasks.push(sub);
    log(sub.assignee, `배정 · ${sub.title}`, sub.id);
    return sub;
  }

  // ---------- 2) 실무 ----------
  async function runSub(sub, answer = null) {
    const a = A(sub.assignee);
    const top = T(sub.parentId);
    a.busy = true;
    a.chatting = false;
    sub.status = 'in_progress';
    sub.startedAt ??= Date.now();
    touch(sub);
    setAgent(a, { status: 'working', floor: a.homeFloor, room: a.homeRoom, activity: `시작 · ${clip(sub.title, 14)}`, taskId: sub.id });
    if (!answer) say(a, `${clip(sub.title, 24)} 시작할게요`);

    const prompt = answer
      ? `대표님 답변: ${answer}\n이 답변을 반영해서 하던 작업을 이어서 끝내 주세요.`
      : workPrompt(sub, top);
    const res = await run(a, sub, {
      kind: 'work', prompt, workdir: top.id, resumeSessionId: answer ? sub.sessionId : null,
      meta: { resumed: !!answer, title: sub.title, role: sub.role, allowQuestion: sub.questionsAsked < 1 },
    });
    if (res.sessionId) sub.sessionId = res.sessionId;

    const q = /^\s*\[질문\]\s*(.+)$/m.exec(res.text || '');
    if (q && !res.isError && sub.questionsAsked < 2) {
      sub.questionsAsked++;
      askCeo(a, sub, q[1].trim());
      return;
    }
    sub.status = res.isError ? 'failed' : 'done';
    sub.result = clip(res.text, 600);
    sub.doneAt = Date.now();
    touch(sub);
    log(a.id, res.isError ? `실패 · ${sub.title} — ${clip(res.text, 60)}` : `완료 · ${sub.title}`, sub.id, res.isError ? 'error' : 'done');
    say(a, res.isError ? '앗, 막혔어요… 😵' : '끝! ✅');
    a.busy = false;
    goHome(a);
    pump();
  }

  function askCeo(a, sub, text) {
    const q = { id: nextId('Q'), taskId: sub.id, agentId: a.id, text: clip(text, 300), status: 'open', createdAt: Date.now() };
    state.questions.unshift(q);
    sub.status = 'waiting';
    touch(sub);
    setAgent(a, { status: 'waiting', floor: 3, room: '대표실 입구', activity: '대표님 답 대기', taskId: sub.id });
    say(a, '대표님께 여쭤보고 올게요 🙋');
    log(a.id, `질문 · ${clip(text, 60)}`, sub.id, 'question');
  }

  function answer(qid, text) {
    const q = state.questions.find((x) => x.id === qid);
    if (!q || q.status !== 'open' || !String(text || '').trim()) return false;
    q.status = 'answered';
    q.answer = clip(text, 500);
    q.answeredAt = Date.now();
    const sub = T(q.taskId);
    const a = A(q.agentId);
    say(a, '알겠습니다! 반영할게요 🙇');
    log(a.id, `대표님 답변 · ${clip(text, 60)}`, sub.id, 'answer');
    setTimeout(() => runSub(sub, q.answer), 1500);
    changed();
    return true;
  }

  // ---------- 3) 검수 ----------
  async function reviewTask(top) {
    const qa = A('geom');
    qa.busy = true;
    qa.chatting = false;
    top.status = 'review';
    touch(top);
    setAgent(qa, { status: 'working', floor: 1, room: '검수실', activity: `검수 · ${clip(top.title, 14)}`, taskId: top.id });
    say(qa, '검수 들어갑니다 🔍');
    const children = kids(top);
    const res = await run(qa, top, {
      kind: 'review', prompt: reviewPrompt(top, children), workdir: top.id,
      meta: { round: top.reviewRound || 0, title: top.title, roles: [...new Set(children.map((k) => k.role))] },
    });
    const r = parseJson(res.text) || { verdict: 'pass', summary: clip(res.text, 200) };
    const issues = (Array.isArray(r.issues) ? r.issues : []).filter((i) => WORK_ROLES.includes(i?.role) && i.title).slice(0, 3);
    const lines = Array.isArray(r.meeting) && r.meeting.length ? r.meeting : null;

    if (r.verdict === 'fix' && issues.length && (top.reviewRound || 0) < 1) {
      top.reviewRound = (top.reviewRound || 0) + 1;
      log('geom', `수정 요청 ${issues.length}건 · ${top.title}`, top.id, 'review');
      await holdMeeting({
        topic: `검수 피드백 · ${clip(top.title, 16)}`, taskId: top.id, ownerIds: ['geom'],
        inviteIds: issues.map((i) => byRole(i.role).id),
        lines: lines || [{ speaker: 'geom', line: `${issues.length}가지만 고치면 될 것 같아요.` }, ...issues.map((i) => ({ speaker: 'geom', line: `${byRole(i.role).name}님: ${i.title}` }))],
      });
      issues.forEach((i) => addSubtask(top, i, true));
      top.status = 'in_progress';
    } else {
      top.review = clip(r.summary || '이상 없음', 300);
      log('geom', `검수 통과 · ${top.title}`, top.id, 'review');
      await holdMeeting({
        topic: `마무리 · ${clip(top.title, 18)}`, taskId: top.id, ownerIds: ['geom'],
        inviteIds: ['maro', ...children.map((k) => k.assignee)],
        lines: lines || wrapLines(top, children),
      });
      top.status = 'wiki_wait';
    }
    touch(top);
    qa.busy = false;
    goHome(qa);
    pump();
  }

  // ---------- 4) 위키 기록 ----------
  async function wikiTask(top) {
    const w = A('sonul');
    w.busy = true;
    w.chatting = false;
    top.status = 'wiki';
    touch(top);
    setAgent(w, { status: 'working', floor: 2, room: '집필실', activity: `위키 · ${clip(top.title, 14)}`, taskId: top.id });
    const res = await run(w, top, { kind: 'wiki', prompt: wikiPrompt(top, kids(top)), workdir: '', meta: { title: top.title, id: top.id } });
    top.status = 'done';
    top.doneAt = Date.now();
    top.result = clip(res.text, 400);
    touch(top);
    state.wiki.unshift({ taskId: top.id, title: top.title, summary: top.result, path: `wiki/${top.id}.md`, at: Date.now() });
    log('sonul', `위키 등록 · wiki/${top.id}.md`, top.id, 'done');
    say(w, '위키에 정리해 뒀어요 📚');
    w.busy = false;
    goHome(w);
    reportToCeo(top);
    pump();
  }

  async function reportToCeo(top) {
    const pm = A('maro');
    if (pm.busy) return;
    pm.busy = true;
    setAgent(pm, { status: 'working', floor: 3, room: '대표실', activity: '완료 보고', taskId: top.id });
    await sleep(9000);
    say(pm, `"${clip(top.title, 20)}" 끝났습니다! 🎉`);
    log('maro', `완료 보고 · ${top.title}`, top.id, 'done');
    await sleep(4000);
    pm.busy = false;
    goHome(pm);
    pump();
  }

  // ---------- 스케줄러 ----------
  function pump() {
    const free = () => activeRuns < maxParallel;
    for (const t of state.tasks) {
      if (t.parentId) continue;
      if (t.status === 'queued' && !A('maro').busy && free()) planTask(t);
      else if (t.status === 'in_progress') {
        const ks = kids(t);
        if (ks.length && ks.every((k) => k.status === 'done' || k.status === 'failed') && !A('geom').busy && free()) reviewTask(t);
      } else if (t.status === 'wiki_wait' && !A('sonul').busy && free()) wikiTask(t);
    }
    for (const s of state.tasks) {
      if (s.parentId && s.status === 'queued' && !A(s.assignee).busy && free()) runSub(s);
    }
    changed();
  }

  // ---------- 쉬는 시간: 돌아다니기·수다 ----------
  async function chat(a, b) {
    const room = a.homeFloor === 2 ? '라운지' : '휴게실';
    for (const x of [a, b]) { x.chatting = true; setAgent(x, { status: 'chatting', floor: x.homeFloor, room, activity: '' }); }
    await sleep(6000);
    const lines = pick(SMALLTALK);
    for (let i = 0; i < lines.length; i++) {
      const sp = i % 2 ? b : a;
      if (sp.busy || !sp.chatting) break;
      say(sp, lines[i], 2800);
      await sleep(3000);
    }
    for (const x of [a, b]) {
      if (!x.busy && x.chatting) { x.chatting = false; x.nextWanderAt = Date.now() + rand(10e3, 20e3); goHome(x); }
    }
  }

  function wander(now) {
    for (const a of state.agents) {
      if (a.busy || a.chatting || now < a.nextWanderAt) continue;
      a.nextWanderAt = now + rand(14e3, 34e3);
      if (a.id === 'maro') {
        if (Math.random() < 0.25) { setAgent(a, { status: 'idle', floor: 1, room: '휴게실', activity: '' }); say(a, '커피 한 잔 ☕'); }
        else goHome(a);
        continue;
      }
      if (Math.random() < 0.2) {
        const mate = state.agents.find((b) => b !== a && b.id !== 'maro' && !b.busy && !b.chatting && b.homeFloor === a.homeFloor);
        if (mate) { chat(a, mate); continue; }
      }
      const places = a.homeFloor === 2
        ? [a.homeRoom, a.homeRoom, '위키 서고', '라운지']
        : [a.homeRoom, a.homeRoom, a.homeRoom, '휴게실', '자료실', '정보검색실'];
      const room = pick(places);
      setAgent(a, { status: 'idle', floor: a.homeFloor, room, activity: '' });
      if (room === '휴게실' && Math.random() < 0.5) say(a, pick(['잠깐 쉬어요 ☕', '물 마시러…', '스트레칭 좀 🙆']));
    }
  }

  function tick() {
    const now = Date.now();
    wander(now);
    if (autoAnswerMs) {
      for (const q of state.questions) {
        if (q.status === 'open' && now - q.createdAt > autoAnswerMs) {
          answer(q.id, '(데모 자동 답변) 알아서 판단해서 진행해 주세요.');
        }
      }
    }
    if (autoDemo && !state.tasks.some((t) => !t.parentId && OPEN.includes(t.status)) && now - lastTaskAt > 40e3) {
      const [title, detail] = pick(DEMO_TASKS);
      addTask(title, detail);
    }
    pump();
  }
  const tickTimer = setInterval(tick, 1000);

  // ---------- 외부 API ----------
  function addTask(title, detail = '') {
    title = clip(title, 80);
    if (!title) return null;
    const t = { id: nextId('T'), parentId: null, title, detail: String(detail).slice(0, 2000), status: 'queued', createdAt: Date.now(), updatedAt: Date.now(), reviewRound: 0 };
    state.tasks.push(t);
    lastTaskAt = Date.now();
    log(null, `새 일감 · ${title}`, t.id, 'task');
    pump();
    return t;
  }

  function metrics() {
    const now = Date.now();
    const tops = state.tasks.filter((t) => !t.parentId);
    const open = tops.filter((t) => OPEN.includes(t.status));
    const openQ = state.questions.filter((q) => q.status === 'open');
    return {
      lanes: open.length,
      workers: state.agents.filter((a) => a.status === 'working' || a.status === 'meeting').length,
      blocked: openQ.length + state.tasks.filter((t) => t.status === 'failed').length,
      openCandidates: open.length,
      buried: state.tasks.filter((t) => t.status === 'queued' && now - t.createdAt > BURIED_MS).length
        + openQ.filter((q) => now - q.createdAt > BURIED_MS).length,
      stalled: state.tasks.filter((t) => t.status === 'in_progress' && t.parentId && now - t.updatedAt > STALL_MS).length,
      done: tops.filter((t) => t.status === 'done').length,
    };
  }

  function snapshot() {
    const { agents, ...rest } = state;
    return JSON.parse(JSON.stringify({
      ...rest,
      now: Date.now(),
      metrics: metrics(),
      agents: agents.map(({ nextWanderAt, ...a }) => a),
    }));
  }

  // 서버 재시작 후 이어서 돌리기
  function restore(snap) {
    if (!snap) return;
    state.seq = snap.seq || 0;
    state.costUsd = snap.costUsd || 0;
    state.tasks = snap.tasks || [];
    state.questions = snap.questions || [];
    state.minutes = snap.minutes || [];
    state.logs = snap.logs || [];
    state.wiki = snap.wiki || [];
    const reset = { planning: 'queued', meeting: 'queued', review: 'in_progress', wiki: 'wiki_wait' };
    for (const t of state.tasks) {
      if (t.parentId && t.status === 'in_progress') t.status = 'queued';
      else if (reset[t.status]) t.status = reset[t.status];
    }
    for (const q of state.questions.filter((x) => x.status === 'open')) {
      const a = A(q.agentId);
      a.busy = true;
      Object.assign(a, { status: 'waiting', floor: 3, room: '대표실 입구', activity: '대표님 답 대기', taskId: q.taskId });
    }
    log(null, '사무실 다시 열림', null);
  }

  return {
    state, addTask, answer, snapshot, restore, pump,
    demoTask: () => addTask(...pick(DEMO_TASKS)),
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    stop() { clearInterval(tickTimer); },
  };
}

// ---------- 프롬프트 ----------
function planPrompt(t) {
  return `대표님 요청 (${t.id})
제목: ${t.title}
내용: ${t.detail || '(없음)'}

팀원: backend=한결(백엔드), frontend=다온(프론트엔드), designer=보라(디자이너).
검수(검이)와 위키 기록(손글씨)은 자동으로 붙으니 하위 일감에 넣지 마세요.

아래 형식의 JSON 하나만 출력하세요. 설명이나 코드펜스 없이.
{"summary":"한 줄 요약","subtasks":[{"role":"backend|frontend|designer","title":"30자 이내","detail":"구체적인 작업 지시"}],"meeting":[{"speaker":"maro|hangyeol|daon|bora|geom","line":"60자 이내 대사"}]}
- 하위 일감은 1~4개, 꼭 필요한 역할만 넣으세요.
- meeting은 킥오프 회의 대사 4~7줄입니다. 마로가 열고 닫으며, 담당자들이 자기 계획을 말하는 실제 회의처럼 쓰세요.`;
}

function workPrompt(sub, top) {
  return `전체 일감 (${top.id}): ${top.title}
${top.detail || ''}
PM 요약: ${top.summary || '-'}

당신의 하위 일감 (${sub.id}): ${sub.title}
${sub.detail}
${sub.fix ? '※ 검수에서 돌아온 수정 요청입니다.' : ''}
다른 팀원 결과물이 이미 있으면 먼저 확인하고 맞춰서 작업하세요.`;
}

function reviewPrompt(top, children) {
  return `일감 (${top.id}) "${top.title}" 의 하위 작업이 모두 끝났습니다. 현재 폴더의 결과물을 검수하세요.
요청 내용: ${top.detail || '-'}
하위 작업:
${children.map((k) => `- [${k.role}] ${k.title} (${k.status}): ${clip(k.result, 200)}`).join('\n')}

아래 형식의 JSON 하나만 출력하세요.
{"verdict":"pass|fix","summary":"검수 결과 한두 줄","issues":[{"role":"backend|frontend|designer","title":"수정할 것","detail":"구체적으로"}],"meeting":[{"speaker":"geom|maro|hangyeol|daon|bora","line":"60자 이내 대사"}]}
- 요청을 못 채우는 큰 문제가 있을 때만 fix 입니다. 사소한 건 pass 하고 summary에 적으세요.
- meeting은 검수 결과를 공유하는 짧은 회의 대사 3~5줄입니다.`;
}

function wikiPrompt(top, children) {
  return `일감 ${top.id} "${top.title}" 이 끝났습니다.
./${top.id}/ 폴더의 결과물을 살펴보고 wiki/${top.id}.md 문서를 작성하세요.
포함할 내용: 요청 요약, 담당자별 한 일, 대표님 질문과 답변, 결과물 파일 목록, 검수 의견, 남은 과제.
하위 작업:
${children.map((k) => `- ${k.title} (${k.assignee}): ${clip(k.result, 200)}`).join('\n')}
검수 의견: ${top.review || '-'}
마지막 답변은 2줄 요약으로 끝내세요.`;
}

function kickoffLines(t, subs) {
  return [
    { speaker: 'maro', line: `"${clip(t.title, 24)}" 킥오프 할게요. ${subs.length}개로 나눴어요.` },
    ...subs.map((s) => ({ speaker: s.role, line: `${clip(s.title, 30)}, 제가 맡을게요.` })),
    { speaker: 'maro', line: '막히면 바로 공유해 주세요 🙌' },
  ];
}

function wrapLines(top, children) {
  const names = [...new Set(children.map((k) => AGENTS.find((a) => a.id === k.assignee)?.name))].join(', ');
  return [
    { speaker: 'geom', line: `검수 끝났어요. "${clip(top.title, 20)}" 통과입니다 ✅` },
    { speaker: 'maro', line: `${names}님 고생하셨어요! 대표님께 보고 올릴게요.` },
  ];
}
