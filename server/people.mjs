// 클라우드·내 PC 의 Claude Code 세션 보고(cloud-report/office-report.mjs)를 모아
// 사람 사무실(frog/web)이 읽는 GET /api/office 모양(frog/docs/CONTRACT.md 4절)으로 만든다.
// 같은 레포의 세션 여러 개는 직원 한 명으로 합친다.

const LOG_N = 8;
const REST_AFTER = 30 * 60e3;     // 이만큼 소식이 없으면 쉬는 중으로 (긴 명령 중일 수 있으니 넉넉히)
const GONE_AFTER = 3 * 3600e3;    // 이만큼 소식이 없으면 퇴근 — 클라우드 컨테이너는 SessionEnd 없이 사라지기도 한다
const RANK = { decision: 2, working: 1, rest: 0 };

const clip = (s, n) => { const a = Array.from(String(s ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const ID = /^[A-Za-z0-9._:-]{1,120}$/;
const KINDS = new Set(['text', 'read', 'edit', 'write', 'bash', 'grep', 'glob', 'fetch', 'search', 'agent', 'todo', 'skill', 'mcp', 'tool']);
const cleanAct = (a) => (a && KINDS.has(a.k) ? { k: a.k, a: clip(a.a, 60) } : null);

export function createPeople({ onChange = () => {} } = {}) {
  const sessions = new Map();

  function report(b) {
    if (!b || !ID.test(String(b.sessionId || ''))) return false;
    const now = Date.now();
    if (b.event === 'SessionEnd') { sessions.delete(b.sessionId); onChange(); return true; }
    let s = sessions.get(b.sessionId);
    if (!s) {
      s = { id: b.sessionId, status: 'rest', ask: '', doing: null, log: [], subs: {}, startedAt: now };
      sessions.set(b.sessionId, s);
    }
    s.repo = clip(String(b.repo || '?').replace(/[^\p{L}\p{N}._ -]/gu, ''), 60) || '?';
    s.where = b.where === 'local' ? 'local' : 'cloud';
    s.link = /^https:\/\/claude\.ai\/code\/[\w-]+$/.test(b.link || '') ? b.link : '';
    s.updatedAt = now;
    const a = cleanAct(b.act);
    switch (b.event) {
      case 'SessionStart': s.status = 'rest'; s.ask = ''; break;
      case 'UserPromptSubmit': s.status = 'working'; s.ask = ''; break;
      case 'PreToolUse':
        s.status = 'working'; s.ask = '';
        if (a) { s.doing = a; s.log.push({ at: new Date(now).toISOString(), ...a }); s.log = s.log.slice(-LOG_N); }
        if (b.sub && ID.test(String(b.toolUseId || ''))) {
          s.subs[b.toolUseId] = { id: b.toolUseId.slice(-6), type: clip(b.sub.type, 24), desc: clip(b.sub.desc, 30), doing: null };
        }
        break;
      case 'PostToolUse':
        if (s.status === 'decision') { s.status = 'working'; s.ask = ''; }
        if (b.toolUseId) delete s.subs[b.toolUseId];
        break;
      case 'Notification': {
        const needs = /permission|input|elicitation/.test(b.notify || '') || /needs your (permission|input)/i.test(b.message || '');
        if (needs) { s.status = 'decision'; s.ask = clip(b.message, 80); }
        else if (b.notify === 'idle_prompt') { s.status = 'rest'; s.ask = ''; }
        break;
      }
      case 'PermissionRequest': s.status = 'decision'; s.ask = clip(b.message, 80); break;
      case 'Stop': s.status = 'rest'; s.ask = ''; s.subs = {}; break;
      default: return false;
    }
    onChange();
    return true;
  }

  function snapshot(now = Date.now()) {
    const byRepo = new Map();
    for (const [id, s] of sessions) {
      if (now - s.updatedAt > GONE_AFTER) { sessions.delete(id); continue; }
      if (s.status !== 'rest' && now - s.updatedAt > REST_AFTER) { s.status = 'rest'; s.ask = ''; s.subs = {}; }
      if (!byRepo.has(s.repo)) byRepo.set(s.repo, []);
      byRepo.get(s.repo).push(s);
    }
    const people = [...byRepo].map(([repo, list]) => {
      const top = list.reduce((x, y) => (RANK[y.status] > RANK[x.status] || (RANK[y.status] === RANK[x.status] && y.updatedAt > x.updatedAt) ? y : x));
      const subs = list.flatMap((s) => Object.values(s.subs));
      const log = list.flatMap((s) => s.log).sort((x, y) => x.at.localeCompare(y.at)).slice(-LOG_N);
      return {
        id: `cloud:${repo}`, name: repo, path: list.some((s) => s.where === 'cloud') ? `cloud/${repo}` : `local/${repo}`,
        status: top.status, pending: list.filter((s) => s.status === 'decision').length, ask: top.status === 'decision' ? top.ask : '',
        sessions: list.length, source: 'hook', commits: null, kid: false, home: null,
        subs: subs.slice(0, 12), subCount: subs.length, doing: top.doing, log,
        links: list.map((s) => s.link).filter(Boolean),
      };
    });
    return { version: 1, now: new Date(now).toISOString(), hooks: true, demo: false, people };
  }

  return {
    report,
    snapshot,
    toJSON: () => ({ sessions: [...sessions.values()] }),
    restore(data) {
      for (const s of data?.sessions || []) if (ID.test(String(s.id || ''))) sessions.set(s.id, { subs: {}, log: [], ...s });
    },
  };
}
