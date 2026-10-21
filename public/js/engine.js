// 사무실 오케스트레이터 — 브라우저(데모)와 Node(실제 Claude) 양쪽에서 그대로 쓴다.
// 화면 좌표는 모르고 "몇 층, 어느 방, 무슨 일" 까지만 상태로 관리한다.

export const AGENTS = [
  { id: 'maro', name: '마로', role: 'pm', title: 'PM·관제', color: '#e8833a', hair: '#5a3a22', homeFloor: 1, homeRoom: '로비' },
  { id: 'hangyeol', name: '한결', role: 'backend', title: '백엔드', color: '#3b7be0', hair: '#26221f', homeFloor: 1, homeRoom: '업무석' },
  { id: 'daon', name: '다온', role: 'frontend', title: '프론트엔드', color: '#22a37f', hair: '#7a4a2a', homeFloor: 1, homeRoom: '업무석' },
  { id: 'bora', name: '보라', role: 'designer', title: '디자이너', color: '#9b5de0', hair: '#3a2546', homeFloor: 1, homeRoom: '업무석' },
  { id: 'haram', name: '하람', role: 'researcher', title: '리서처', color: '#0f9bb4', hair: '#3b2a20', homeFloor: 1, homeRoom: '업무석' },
  { id: 'dodam', name: '도담', role: 'docs', title: '문서·PPT', color: '#c2417a', hair: '#2a1f1a', homeFloor: 1, homeRoom: '업무석' },
  { id: 'geom', name: '검이', role: 'qa', title: 'QA·검수', color: '#e0566a', hair: '#1f1f1f', homeFloor: 1, homeRoom: '업무석' },
  { id: 'sonul', name: '손글씨', role: 'writer', title: '위키 기록', color: '#d39b16', hair: '#4a3322', homeFloor: 2, homeRoom: '집필실' },
];

// PM이 일감마다 골라 쓰는 실무 역할
export const WORK_ROLES = ['researcher', 'docs', 'designer', 'frontend', 'backend'];
const ROLE_DESC = {
  researcher: '하람(리서처: 웹 조사 → 출처 포함 정리 문서)',
  docs: '도담(문서·PPT: 보고서, 강의자료, 발표 PPT 파일 제작)',
  designer: '보라(디자이너: 시안, 디자인 토큰, 레이아웃)',
  frontend: '다온(프론트엔드: 화면, 웹 페이지, 컴포넌트)',
  backend: '한결(백엔드: API, 데이터, 스크립트, 자동화)',
};

const SYSTEM = {
  pm: "당신은 'AI 사무실'의 PM 겸 관제 담당 '마로'입니다. 대표님 요청을 이해하고, 필요한 사람만 골라 일을 나누고 순서를 정합니다.",
  backend: "당신은 'AI 사무실'의 백엔드 개발자 '한결'입니다. API, 데이터, 스크립트, 서버 로직을 맡습니다.",
  frontend: "당신은 'AI 사무실'의 프론트엔드 개발자 '다온'입니다. 화면, 컴포넌트, 웹 페이지를 맡습니다.",
  designer: "당신은 'AI 사무실'의 디자이너 '보라'입니다. 시안은 HTML/CSS, SVG, 디자인 토큰 파일처럼 코드로 남깁니다.",
  researcher: "당신은 'AI 사무실'의 리서처 '하람'입니다. WebSearch와 WebFetch로 자료를 조사하고, 핵심 내용과 출처 URL을 research.md 같은 마크다운 파일로 정리합니다. 다음 사람이 바로 쓸 수 있게 목차와 요점 위주로 구조화하세요.",
  docs: "당신은 'AI 사무실'의 문서·PPT 작업자 '도담'입니다. 보고서, 강의자료, 발표자료를 만듭니다. PPT는 python3와 python-pptx로 스크립트(make_ppt.py)를 작성하고 실행해서 .pptx 파일로 만듭니다. 대표님이 지정한 파일명을 정확히 지키세요. python-pptx가 없으면 직접 설치하지 말고 \"[질문] python-pptx 설치가 필요합니다 (pip install python-pptx)\" 로 알려 주세요.",
  qa: "당신은 'AI 사무실'의 QA '검이'입니다. 결과물을 읽고 실행해 보며 검수합니다. 파일은 수정하지 않습니다.",
  writer: "당신은 'AI 사무실'의 위키 기록 담당 '손글씨'입니다. 끝난 일을 다른 사람이 이해할 수 있게 문서로 남깁니다.",
};

const WORK_RULES = `
규칙:
- 작업은 현재 폴더 안에서만 하세요. 같은 일감의 다른 팀원도 이 폴더를 함께 씁니다.
- 결과물은 반드시 파일로 남기세요. 대표님이 파일명을 지정했다면 그대로 쓰세요.
- 대표님 결정이 꼭 필요하면 작업을 멈추고 마지막 답변을 "[질문] 질문 내용" 한 줄로 끝내세요. 사소한 건 스스로 판단하세요.
- 끝나면 한 일과 만든 파일을 3줄 이내 한국어로 요약하세요.`;

const SMALLTALK = [
  ['어제 배포 잘 됐어요?', '네, 롤백 없이 깔끔했어요 👍'],
  ['점심 뭐 먹을래요?', '국밥 어때요?', '좋아요 🍲'],
  ['이번 스프린트 빡세네요', '그래도 거의 다 왔어요 💪'],
  ['커피 머신 고쳐졌대요', '오 드디어!'],
  ['대표님 오늘 기분 좋아 보이시던데', '컨펌 타이밍이다…'],
  ['그 버그 원인 찾았어요?', '캐시였어요. 역시 캐시…', '항상 캐시죠 😇'],
  ['자료 조사 어디서 해요?', '논문이랑 공식 문서 먼저 봐요 📚'],
  ['슬라이드 몇 장까지 괜찮아요?', '강의면 15장 안쪽이 좋더라고요'],
];

const DEMO_TASKS = [
  ['AI 활용 강의자료 PPT 만들기', '생성형 AI 업무 활용 사례를 리서치해서 강의자료 만들어줘. 파일명은 AI활용강의.pptx. 2명이서 협업해.'],
  ['우리집 가전 관리 페이지에 필터 청소 알림 추가', '세탁기·에어컨 필터 청소 주기를 계산해서 다가오는 일정을 보여주는 기능'],
  ['사무실 소개 랜딩 페이지 만들기', '팀원 소개와 하는 일을 보여주는 한 페이지짜리 랜딩'],
  ['전기요금 절약 방법 조사 보고서', '가정용 전기요금 절약 팁을 조사해서 보고서로 정리. 파일명 전기요금_절약.md'],
  ['로그인 화면 리디자인', '모바일에서 보기 좋은 로그인 화면 시안과 구현'],
];

const OPEN = ['queued', 'planning', 'meeting', 'in_progress', 'review_wait', 'review', 'confirm_wait', 'confirm', 'wiki_wait', 'wiki', 'waiting'];
const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
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

// "2명이서", "두 명", "혼자" 같은 표현에서 인원 수를 읽는다
export function parseHeadcount(text) {
  const s = String(text || '');
  if (/혼자|1인|한\s*명/.test(s)) return 1;
  const m = /(\d+)\s*(?:명|인)/.exec(s);
  if (m) return Number(m[1]);
  const words = { 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5 };
  const w = /(두|둘|세|셋|네|넷|다섯)\s*(?:명|이서)/.exec(s);
  return w ? words[w[1]] : null;
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
  if (WRITE_TOOLS.includes(name)) return { ...desk, act: `작성 · ${clip(base(input.file_path), 18)}` };
  if (name === 'Bash') {
    const cmd = String(input.command || '').trim();
    const words = cmd.split(/\s+/);
    if (/^git\b/.test(cmd)) return { floor: 1, room: '서버실', act: `명령 · git ${words[1] || ''}`.trim() };
    if (/\b(test|jest|vitest|pytest|lint)\b/.test(cmd)) return { floor: 1, room: '검수실', act: `테스트 · ${clip(cmd, 16)}` };
    if (/^python3?\b/.test(cmd) && agent.role === 'docs') return { ...desk, act: `파일 생성 · ${clip(base(words[1]), 14)}` };
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
    approvals: [],
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
  const rootOf = (t) => (t.parentId ? T(t.parentId) : t);
  const nextId = (p) => `${p}-${String(++state.seq).padStart(3, '0')}`;
  const resolveSpeaker = (k) => A(k) || byRole(k) || state.agents.find((a) => a.name === k);
  const finished = (t) => t.status === 'done' || t.status === 'failed';

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

  function addFiles(top, files) {
    const set = new Set(top.files || []);
    for (const f of files) if (f && !/(^|\/)(\.git|node_modules)(\/|$)/.test(f)) set.add(f);
    top.files = [...set].slice(0, 60);
  }

  // ---------- 러너 호출 ----------
  async function run(agent, task, opts) {
    activeRuns++;
    let lastSay = 0;
    const top = rootOf(task);
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
            if (opts.kind === 'work' && ev.file && WRITE_TOOLS.includes(ev.name)) addFiles(top, [ev.file]);
          } else if (ev.type === 'text' && opts.kind === 'work' && ev.text && Date.now() - lastSay > 6000) {
            lastSay = Date.now();
            say(agent, clip(ev.text, 60));
          }
        },
      });
      if (res.costUsd) state.costUsd += res.costUsd;
      if (opts.kind === 'work' && runner.listFiles) addFiles(top, await runner.listFiles(top.id).catch(() => []));
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
      const raw = String(line.line ?? line.text ?? '');
      const text = clip(raw.startsWith(`${sp.name}:`) ? raw.slice(sp.name.length + 1) : raw, 90);
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

  // ---------- 1) 기획: PM이 사람·순서를 정한다 ----------
  async function planTask(t) {
    const pm = A('maro');
    pm.busy = true;
    pm.chatting = false;
    t.status = 'planning';
    touch(t);
    setAgent(pm, { status: 'working', floor: 1, room: '회의실', activity: `기획 · ${clip(t.title, 14)}`, taskId: t.id });
    say(pm, t.headcount ? `새 일감! ${t.headcount}명으로 짜 볼게요 📝` : '새 일감 들어왔어요! 쪼개 볼게요 📝');
    log('maro', `일감 접수 · ${t.title}${t.headcount ? ` (${t.headcount}명)` : ''}`, t.id);

    const res = await run(pm, t, { kind: 'plan', prompt: planPrompt(t), workdir: t.id, meta: { headcount: t.headcount } });
    const plan = parseJson(res.text) || {};
    const subs = normalizePlan(plan.subtasks, t);
    t.summary = clip(plan.summary || t.title, 120);

    t.status = 'meeting';
    touch(t);
    const lines = Array.isArray(plan.meeting) && plan.meeting.length ? plan.meeting : kickoffLines(t, subs);
    await holdMeeting({
      topic: `킥오프 · ${clip(t.title, 18)}`, taskId: t.id, ownerIds: ['maro'],
      inviteIds: subs.map((s) => byRole(s.role).id).concat('geom'), lines,
    });

    const ids = [];
    for (const s of subs) ids.push(addSubtask(t, { ...s, after: s.after.map((i) => ids[i]) }).id);
    t.status = 'in_progress';
    touch(t);
    pm.busy = false;
    goHome(pm);
    pump();
  }

  // 역할 검증, 인원 제한, 선행 작업(앞쪽 일감만 가리키게) 정리
  function normalizePlan(list, t) {
    let subs = (Array.isArray(list) ? list : []).filter((s) => WORK_ROLES.includes(s?.role) && s.title).slice(0, 5);
    if (!subs.length) subs = [{ role: 'backend', title: clip(t.title, 30), detail: t.detail || t.title }];
    if (t.headcount) {
      const roles = [...new Set(subs.map((s) => s.role))];
      const keep = roles.slice(0, t.headcount);
      subs = subs.map((s) => (keep.includes(s.role) ? s : { ...s, role: keep[keep.length - 1] }));
    }
    const keyIdx = new Map(subs.map((s, i) => [String(s.key ?? i), i]));
    return subs.map((s, i) => ({
      role: s.role, title: s.title, detail: s.detail,
      after: [...new Set((Array.isArray(s.after) ? s.after : []).map((k) => keyIdx.get(String(k))).filter((j) => j != null && j < i))],
    }));
  }

  function addSubtask(top, s, fix = false) {
    const sub = {
      id: nextId('T'), parentId: top.id, role: s.role, title: clip(s.title, 40), detail: String(s.detail || ''),
      assignee: byRole(s.role).id, status: 'queued', fix, after: s.after || [], createdAt: Date.now(), updatedAt: Date.now(),
      sessionId: null, result: '', questionsAsked: 0,
    };
    state.tasks.push(sub);
    const wait = sub.after.length ? ` (${sub.after.join(', ')} 끝나면 시작)` : '';
    log(sub.assignee, `배정 · ${sub.title}${wait}`, sub.id);
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

    // 선행 작업을 다른 사람이 했으면 인수인계 회의부터
    const deps = sub.after.map(T).filter(Boolean);
    const givers = [...new Set(deps.map((d) => d.assignee))].filter((id) => id !== a.id);
    if (!answer && givers.length && !sub.handedOff) {
      sub.handedOff = true;
      await holdMeeting({
        topic: `인수인계 · ${clip(sub.title, 16)}`, taskId: sub.id, ownerIds: [a.id], inviteIds: givers,
        lines: [
          ...deps.filter((d) => d.assignee !== a.id).map((d) => ({ speaker: d.assignee, line: `${clip(d.title, 20)} 끝났어요. ${clip(d.result, 50)}` })),
          { speaker: a.id, line: '받았어요! 이걸로 바로 시작할게요 👍' },
        ],
      });
    }

    setAgent(a, { status: 'working', floor: a.homeFloor, room: a.homeRoom, activity: `시작 · ${clip(sub.title, 14)}`, taskId: sub.id });
    if (!answer) say(a, `${clip(sub.title, 24)} 시작할게요`);

    const prompt = answer
      ? `대표님 답변: ${answer}\n이 답변을 반영해서 하던 작업을 이어서 끝내 주세요.`
      : workPrompt(sub, top, deps);
    const res = await run(a, sub, {
      kind: 'work', prompt, workdir: top.id, resumeSessionId: answer ? sub.sessionId : null,
      meta: { resumed: !!answer, title: sub.title, role: sub.role, allowQuestion: sub.questionsAsked < 1, request: `${top.title} ${top.detail || ''}`, fix: sub.fix },
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
        inviteIds: [...new Set(children.map((k) => k.assignee))],
        lines: lines || wrapLines(top, children),
      });
      top.status = 'confirm_wait';
    }
    touch(top);
    qa.busy = false;
    goHome(qa);
    pump();
  }

  // ---------- 4) 대표 컨펌 ----------
  // 다른 일감이 기다리지 않는 마지막 결과물 담당자가 3층에 올라가 보고한다
  function presenterOf(top) {
    const ks = kids(top).filter((k) => k.status === 'done');
    const needed = new Set(ks.flatMap((k) => k.after));
    const leaves = ks.filter((k) => !needed.has(k.id));
    return A((leaves[leaves.length - 1] || ks[ks.length - 1])?.assignee || 'maro');
  }

  function requestConfirm(top) {
    const p = presenterOf(top);
    p.busy = true;
    p.chatting = false;
    top.status = 'confirm';
    top.confirmRound = (top.confirmRound || 0) + 1;
    touch(top);
    const ap = {
      id: nextId('A'), taskId: top.id, agentId: p.id, round: top.confirmRound, status: 'open', createdAt: Date.now(),
      summary: clip([top.review, ...kids(top).filter((k) => k.status === 'done').slice(-2).map((k) => k.result)].filter(Boolean).join(' / '), 400),
      files: (top.files || []).filter((f) => !/^wiki\//.test(f)),
    };
    state.approvals.unshift(ap);
    setAgent(p, { status: 'waiting', floor: 3, room: '대표실', activity: '컨펌 요청', taskId: top.id });
    say(p, '대표님, 컨펌 부탁드립니다 🙏', 5000);
    log(p.id, `컨펌 요청 · ${top.title}${ap.round > 1 ? ` (${ap.round}차)` : ''}`, top.id, 'confirm');
  }

  function decide(aid, approve, comment = '') {
    const ap = state.approvals.find((x) => x.id === aid);
    if (!ap || ap.status !== 'open') return false;
    if (!approve && !String(comment).trim()) return false;
    const top = T(ap.taskId);
    const p = A(ap.agentId);
    ap.status = approve ? 'approved' : 'changes';
    ap.comment = clip(comment, 500);
    ap.decidedAt = Date.now();
    if (approve) {
      say(p, '감사합니다! 마무리할게요 🙇');
      log(p.id, `대표님 승인 · ${top.title}`, top.id, 'done');
      top.status = 'wiki_wait';
    } else {
      say(p, '네, 수정해서 다시 올게요 ✍️');
      log(p.id, `대표님 수정 요청 · ${clip(comment, 60)}`, top.id, 'answer');
      const ks = kids(top).filter((k) => k.status === 'done');
      const needed = new Set(ks.flatMap((k) => k.after));
      const roles = [...new Set(ks.filter((k) => !needed.has(k.id)).map((k) => k.role))];
      for (const role of roles.length ? roles : [byRole('docs').role]) {
        addSubtask(top, { role, title: '대표님 수정 요청 반영', detail: `대표님 코멘트: ${comment}` }, true);
      }
      top.status = 'in_progress';
    }
    touch(top);
    setTimeout(() => { p.busy = false; goHome(p); pump(); }, 2500);
    changed();
    return true;
  }

  // ---------- 5) 위키 기록 ----------
  async function wikiTask(top) {
    const w = A('sonul');
    w.busy = true;
    w.chatting = false;
    top.status = 'wiki';
    touch(top);
    setAgent(w, { status: 'working', floor: 2, room: '집필실', activity: `위키 · ${clip(top.title, 14)}`, taskId: top.id });
    const res = await run(w, top, { kind: 'wiki', prompt: wikiPrompt(top, kids(top), state.approvals.filter((x) => x.taskId === top.id)), workdir: '', meta: { title: top.title, id: top.id } });
    top.status = 'done';
    top.doneAt = Date.now();
    top.result = clip(res.text, 400);
    touch(top);
    state.wiki.unshift({ taskId: top.id, title: top.title, summary: top.result, path: `wiki/${top.id}.md`, files: top.files || [], at: Date.now() });
    log('sonul', `위키 등록 · wiki/${top.id}.md`, top.id, 'done');
    say(w, '위키에 정리해 뒀어요 📚');
    w.busy = false;
    goHome(w);
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
        if (ks.length && ks.every(finished) && !A('geom').busy && free()) reviewTask(t);
      } else if (t.status === 'confirm_wait' && !presenterOf(t).busy) requestConfirm(t);
      else if (t.status === 'wiki_wait' && !A('sonul').busy && free()) wikiTask(t);
    }
    for (const s of state.tasks) {
      if (!s.parentId || s.status !== 'queued' || A(s.assignee).busy || !free()) continue;
      if ((s.after || []).every((id) => { const d = T(id); return !d || finished(d); })) runSub(s);
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
        if (q.status === 'open' && now - q.createdAt > autoAnswerMs) answer(q.id, '(데모 자동 답변) 알아서 판단해서 진행해 주세요.');
      }
      for (const ap of state.approvals) {
        if (ap.status !== 'open' || now - ap.createdAt < autoAnswerMs) continue;
        if (ap.round === 1 && Math.random() < 0.3) decide(ap.id, false, '(데모 자동 답변) 표지 문구를 조금 더 짧게 다듬어 주세요.');
        else decide(ap.id, true);
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
  function newTop(title, detail, extra = {}) {
    const t = {
      id: nextId('T'), parentId: null, title: clip(title, 80), detail: String(detail).slice(0, 2000), status: 'queued',
      createdAt: Date.now(), updatedAt: Date.now(), reviewRound: 0, files: [], headcount: parseHeadcount(`${title} ${detail}`), ...extra,
    };
    state.tasks.push(t);
    lastTaskAt = Date.now();
    return t;
  }

  function addTask(title, detail = '') {
    if (!clip(title, 80)) return null;
    const t = newTop(title, detail);
    log(null, `새 일감 · ${t.title}`, t.id, 'task');
    pump();
    return t;
  }

  // 직원을 찍어서 PM을 거치지 않고 바로 시킨다
  function assign(agentId, title, detail = '') {
    const a = A(agentId);
    if (!a || !WORK_ROLES.includes(a.role) || !clip(title, 80)) return null;
    const t = newTop(title, detail, { status: 'in_progress', direct: agentId, summary: clip(title, 120) });
    addSubtask(t, { role: a.role, title, detail: detail || title });
    log(null, `대표님 직접 지시 → ${a.name} · ${t.title}`, t.id, 'task');
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
      ceoWaiting: openQ.length + state.approvals.filter((x) => x.status === 'open').length,
      openCandidates: open.length,
      buried: state.tasks.filter((t) => t.status === 'queued' && now - t.createdAt > BURIED_MS && !(t.after || []).length).length
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
    for (const k of ['tasks', 'questions', 'approvals', 'minutes', 'logs', 'wiki']) state[k] = snap[k] || [];
    const reset = { planning: 'queued', meeting: 'queued', review: 'in_progress', wiki: 'wiki_wait' };
    for (const t of state.tasks) {
      t.after ||= [];
      if (t.parentId && t.status === 'in_progress') t.status = 'queued';
      else if (reset[t.status]) t.status = reset[t.status];
    }
    for (const q of state.questions.filter((x) => x.status === 'open')) {
      Object.assign(A(q.agentId), { busy: true, status: 'waiting', floor: 3, room: '대표실 입구', activity: '대표님 답 대기', taskId: q.taskId });
    }
    for (const ap of state.approvals.filter((x) => x.status === 'open')) {
      Object.assign(A(ap.agentId), { busy: true, status: 'waiting', floor: 3, room: '대표실', activity: '컨펌 요청', taskId: ap.taskId });
    }
    log(null, '사무실 다시 열림', null);
  }

  return {
    state, addTask, assign, answer, decide, snapshot, restore, pump,
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

고를 수 있는 팀원 (역할 키: 설명):
${WORK_ROLES.map((r) => `- ${r}: ${ROLE_DESC[r]}`).join('\n')}
검수(검이)와 위키 기록(손글씨)은 자동으로 붙으니 넣지 마세요.

아래 형식의 JSON 하나만 출력하세요. 설명이나 코드펜스 없이.
{"summary":"한 줄 요약","subtasks":[{"key":"a","role":"역할 키","title":"30자 이내","detail":"구체적인 작업 지시","after":[]}],"meeting":[{"speaker":"maro 또는 역할 키","line":"60자 이내 대사"}]}
- 요청에 꼭 필요한 역할만 고르세요. 개발 일이 아니면 개발자를 넣지 마세요.
${t.headcount ? `- 대표님이 ${t.headcount}명으로 하라고 했습니다. 서로 다른 역할은 정확히 ${t.headcount}개 이하로만 쓰세요.\n` : ''}- 앞 사람 결과가 있어야 시작할 수 있는 일감은 after에 선행 일감의 key를 넣으세요. (예: 리서치 → PPT 제작)
- 대표님이 지정한 파일명, 형식, 분량은 해당 일감 detail에 그대로 적으세요.
- 하위 일감은 1~5개입니다.
- meeting은 킥오프 회의 대사 4~7줄입니다. 마로가 열고 닫으며, 담당자들이 자기 계획과 넘겨받을 것을 말하는 실제 회의처럼 쓰세요.`;
}

function workPrompt(sub, top, deps = []) {
  return `전체 일감 (${top.id}): ${top.title}
${top.detail || ''}
PM 요약: ${top.summary || '-'}

당신의 하위 일감 (${sub.id}): ${sub.title}
${sub.detail}
${sub.fix ? '※ 검수 또는 대표님 수정 요청입니다. 기존 결과물을 고쳐서 같은 파일명으로 다시 내 주세요.' : ''}
${deps.length ? `선행 작업 결과 (이 폴더에 파일이 있습니다):\n${deps.map((d) => `- ${d.title}: ${clip(d.result, 300)}`).join('\n')}` : '다른 팀원 결과물이 이미 있으면 먼저 확인하고 맞춰서 작업하세요.'}`;
}

function reviewPrompt(top, children) {
  return `일감 (${top.id}) "${top.title}" 의 하위 작업이 모두 끝났습니다. 현재 폴더의 결과물을 검수하세요.
요청 내용: ${top.detail || '-'}
현재 파일: ${(top.files || []).join(', ') || '(파악 안 됨)'}
하위 작업:
${children.map((k) => `- [${k.role}] ${k.title} (${k.status}): ${clip(k.result, 200)}`).join('\n')}

아래 형식의 JSON 하나만 출력하세요.
{"verdict":"pass|fix","summary":"검수 결과 한두 줄","issues":[{"role":"역할 키","title":"수정할 것","detail":"구체적으로"}],"meeting":[{"speaker":"geom 또는 역할 키","line":"60자 이내 대사"}]}
- 요청한 파일명·형식이 지켜졌는지 꼭 확인하세요.
- 요청을 못 채우는 큰 문제가 있을 때만 fix 입니다. 사소한 건 pass 하고 summary에 적으세요.
- meeting은 검수 결과를 공유하는 짧은 회의 대사 3~5줄입니다.`;
}

function wikiPrompt(top, children, approvals) {
  return `일감 ${top.id} "${top.title}" 이 끝났습니다.
./${top.id}/ 폴더의 결과물을 살펴보고 wiki/${top.id}.md 문서를 작성하세요.
포함할 내용: 요청 요약, 담당자별 한 일, 대표님 질문·컨펌 이력, 결과물 파일 목록, 검수 의견, 남은 과제.
하위 작업:
${children.map((k) => `- ${k.title} (${k.assignee}): ${clip(k.result, 200)}`).join('\n')}
검수 의견: ${top.review || '-'}
컨펌 이력: ${approvals.map((x) => `${x.round}차 ${x.status === 'approved' ? '승인' : `수정 요청(${x.comment})`}`).join(' / ') || '-'}
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
    { speaker: children[children.length - 1]?.assignee || 'geom', line: `${names}님 고생하셨어요! 대표님께 컨펌 받으러 갈게요.` },
  ];
}
