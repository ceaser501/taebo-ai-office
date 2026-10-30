// 태보 AI 사무실 서버 — 정적 파일 + 실시간 상태(SSE) + 일감/답변 API. 외부 의존성 없음.
//   MODE=sim    (기본) 가짜 러너로 시뮬레이션
//   MODE=claude 실제 Claude Code(`claude -p`)로 일함 — 토큰 비용이 듭니다
// 밖에서 쓰는 서버(Hugging Face Spaces 등)에서는 아래도 쓴다. 자세한 건 deploy/README.md
//   OFFICE_PASSWORD  화면 로그인 비밀번호      OFFICE_TOKEN  세션 보고(/api/report) 토큰
//   SUPABASE_URL, SUPABASE_SECRET_KEY  상태·결과물을 Supabase 에 저장(재시작해도 남게)
// /people/ 는 사람 사무실(frog/web) — 클라우드·내 PC 의 Claude Code 세션 보고를 직원으로 보여 준다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from './public/js/engine.js';
import { createSimRunner } from './public/js/sim-runner.js';
import { createClaudeRunner } from './server/claude-runner.mjs';
import { createPeople } from './server/people.mjs';
import { createStore, syncRunner, typeOf } from './server/store.mjs';
import { createAuth, tokenOk } from './server/auth.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PEOPLE_WEB = path.join(ROOT, 'frog', 'web');
const PORT = Number(process.env.PORT || 4300);
const MODE = process.env.MODE === 'claude' ? 'claude' : 'sim';
const WORKSPACE = path.resolve(process.env.WORKSPACE || path.join(ROOT, 'workspace'));
// 이 주소에서 연 화면(GitHub Pages 등)이 내 PC의 서버에 붙을 수 있다. 쉼표로 여러 개.
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS ?? 'https://ceaser501.github.io').split(',').map((s) => s.trim()).filter(Boolean);
const REPORT_TOKEN = process.env.OFFICE_TOKEN || '';
const auth = createAuth(process.env.OFFICE_PASSWORD || '');

const store = createStore({
  dataDir: path.join(ROOT, 'data'),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
});

const baseRunner = MODE === 'claude'
  ? createClaudeRunner({
    workspace: WORKSPACE,
    model: process.env.CLAUDE_MODEL || undefined,
    workTools: process.env.ALLOWED_TOOLS ? process.env.ALLOWED_TOOLS.split(',').map((s) => s.trim()) : undefined,
  })
  : createSimRunner({ speed: Number(process.env.SIM_SPEED || 1) });
const runner = MODE === 'claude' ? syncRunner(baseRunner, store, WORKSPACE) : baseRunner;

const engine = createEngine({
  runner,
  mode: MODE,
  maxParallel: Number(process.env.MAX_PARALLEL || (MODE === 'claude' ? 2 : 3)),
  autoDemo: MODE === 'sim' && process.env.AUTO_DEMO !== '0',
  autoAnswerMs: MODE === 'sim' ? 60e3 : 0,
});

// ---------- 상태 불러오기·저장 ----------
const people = createPeople({ onChange: () => later('people', () => people.toJSON()) });
try { engine.restore(await store.load('state')); } catch (e) { console.warn('사무실 상태를 못 불러왔어요:', e.message); }
try { people.restore(await store.load('people')); } catch (e) { console.warn('세션 보고를 못 불러왔어요:', e.message); }
engine.state.mode = MODE;
engine.state.features = { people: true };

const timers = {};
function later(id, get) {
  clearTimeout(timers[id]);
  timers[id] = setTimeout(() => store.save(id, get()).catch((e) => console.warn(`저장 실패(${id}):`, e.message)), store.kind === 'file' ? 1500 : 4000);
}

const clients = new Set();
engine.subscribe((snap) => {
  const msg = `data: ${JSON.stringify(snap)}\n\n`;
  for (const res of clients) res.write(msg);
  later('state', () => engine.snapshot());
});
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20e3);

// ---------- HTTP ----------
// 같은 주소에서 연 화면이거나 허용한 출처면 통과. 다른 사이트가 몰래 일을 시키지 못하게 막는다.
const warned = new Set();
function checkOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { if (new URL(origin).host === req.headers.host) return true; } catch {}
  if (!ALLOW_ORIGINS.includes(origin)) {
    if (!warned.has(origin)) { warned.add(origin); console.warn(`거부한 화면 주소: ${origin}  (허용하려면 ALLOW_ORIGINS=${origin} 로 실행)`); }
    return false;
  }
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'origin');
  return true;
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req, limit = 100e3) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > limit) throw new Error('too large'); }
  return s ? JSON.parse(s) : {};
}

async function serveStatic(res, dir, rel) {
  const file = path.join(dir, path.normalize(`/${rel}`));
  if (!file.startsWith(dir)) return json(res, 403, { error: 'forbidden' });
  const data = await readFile(file);
  res.writeHead(200, { 'content-type': typeOf(file) });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/healthz') return json(res, 200, { ok: true });

    // 세션 보고는 로그인 대신 토큰으로 받는다
    if (p === '/api/report') {
      if (!REPORT_TOKEN) return json(res, 404, { error: 'OFFICE_TOKEN 이 설정되지 않았어요' });
      if (req.method !== 'POST') return json(res, 405, { error: 'POST 만 받아요' });
      if (!tokenOk(req, REPORT_TOKEN)) return json(res, 401, { error: '토큰이 맞지 않아요' });
      return people.report(await body(req, 20e3)) ? json(res, 200, { ok: true }) : json(res, 400, { error: '알 수 없는 보고' });
    }

    if (auth) {
      if (await auth.handle(req, res, url)) return;
      if (!auth.ok(req)) {
        if (p.startsWith('/api/') || p.startsWith('/files/')) return json(res, 401, { error: '로그인이 필요해요' });
        res.writeHead(302, { location: `/login?next=${encodeURIComponent(p + url.search)}` });
        return res.end();
      }
    }

    const allowed = checkOrigin(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(allowed ? 204 : 403, allowed ? {
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-private-network': 'true',
        'access-control-max-age': '600',
      } : {});
      return res.end();
    }
    if (!allowed) {
      // 거부 사실만은 화면이 읽을 수 있게 해서 원인을 안내하게 한다 (데이터는 주지 않음)
      res.setHeader('access-control-allow-origin', req.headers.origin);
      return json(res, 403, { error: '허용되지 않은 출처예요. ALLOW_ORIGINS 를 확인하세요.' });
    }

    // 사람 사무실(frog/web) — 화면은 /people/, 데이터는 원본처럼 /api/office·/api/config
    if (p === '/people') { res.writeHead(302, { location: `/people/${url.search}` }); return res.end(); }
    if (p.startsWith('/people/')) return await serveStatic(res, PEOPLE_WEB, p === '/people/' ? 'index.html' : p.slice(8));
    if (p === '/api/office') return json(res, 200, people.snapshot());
    if (p === '/api/config') return json(res, 200, { lang: 'auto' });

    if (p === '/api/state') return json(res, 200, engine.snapshot());
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(engine.snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' && p === '/api/tasks') {
      const { title, detail } = await body(req);
      const t = engine.addTask(String(title || ''), String(detail || ''));
      return t ? json(res, 200, { id: t.id }) : json(res, 400, { error: '제목이 필요해요' });
    }
    if (req.method === 'POST' && p === '/api/demo') return json(res, 200, { id: engine.demoTask()?.id });
    if (req.method === 'POST' && p === '/api/assign') {
      const { agentId, title, detail } = await body(req);
      const t = engine.assign(String(agentId || ''), String(title || ''), String(detail || ''));
      return t ? json(res, 200, { id: t.id }) : json(res, 400, { error: '지시할 수 없는 직원이거나 제목이 없어요' });
    }
    const ap = /^\/api\/approvals\/([\w-]+)$/.exec(p);
    if (req.method === 'POST' && ap) {
      const { approve, comment } = await body(req);
      return engine.decide(ap[1], Boolean(approve), String(comment || '')) ? json(res, 200, { ok: true }) : json(res, 400, { error: '처리할 수 없는 컨펌' });
    }
    if (p.startsWith('/files/')) {
      const rel = path.normalize(decodeURIComponent(p.slice(7))).replace(/^([/\\])+/, '');
      const file = path.join(WORKSPACE, rel);
      if (!file.startsWith(WORKSPACE + path.sep)) return json(res, 403, { error: 'forbidden' });
      // 내 디스크에 없으면(재시작 뒤) 저장소에서 가져온다
      const data = await readFile(file).catch(() => store.fetchFile(rel.split(path.sep).join('/')));
      if (!data) return json(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'content-type': typeOf(file),
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
      });
      return res.end(data);
    }
    const m = /^\/api\/questions\/([\w-]+)\/answer$/.exec(p);
    if (req.method === 'POST' && m) {
      const { text } = await body(req);
      return engine.answer(m[1], String(text || '')) ? json(res, 200, { ok: true }) : json(res, 400, { error: '답할 수 없는 질문' });
    }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    return await serveStatic(res, PUBLIC, p === '/' ? 'index.html' : p);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'EISDIR') return json(res, 404, { error: 'not found' });
    json(res, 500, { error: String(e.message || e) });
  }
});

server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`\n${PORT}번 포트를 이미 다른 프로그램이 쓰고 있어요. (아까 띄운 서버가 아직 켜져 있을 수 있어요)`);
  console.error(`  끄기:          kill $(lsof -t -i :${PORT})`);
  console.error(`  다른 포트로:   PORT=${PORT + 1} npm run start:claude   (Pages에서는 ?server=http://localhost:${PORT + 1} 로 한 번 열기)\n`);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`태보 AI 사무실 → http://localhost:${PORT}  (모드: ${MODE === 'claude' ? '실제 Claude' : '시뮬레이션'})`);
  console.log(`사람 사무실   → http://localhost:${PORT}/people/`);
  if (MODE === 'claude') console.log(`작업 폴더: ${WORKSPACE}`);
  console.log(`저장소: ${store.kind === 'supabase' ? 'Supabase' : '로컬 data/'} · 로그인: ${auth ? '켜짐' : '꺼짐'} · 세션 보고: ${REPORT_TOKEN ? '받음' : '꺼짐(OFFICE_TOKEN 없음)'}`);
  if (ALLOW_ORIGINS.length) console.log(`외부 화면 연결 허용: ${ALLOW_ORIGINS.join(', ')}`);
});
