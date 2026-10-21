// 태보 AI 사무실 서버 — 정적 파일 + 실시간 상태(SSE) + 일감/답변 API. 외부 의존성 없음.
//   MODE=sim    (기본) 가짜 러너로 시뮬레이션
//   MODE=claude 실제 Claude Code(`claude -p`)로 일함 — 토큰 비용이 듭니다
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from './public/js/engine.js';
import { createSimRunner } from './public/js/sim-runner.js';
import { createClaudeRunner } from './server/claude-runner.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data', 'state.json');
const PORT = Number(process.env.PORT || 4300);
const MODE = process.env.MODE === 'claude' ? 'claude' : 'sim';
const WORKSPACE = path.resolve(process.env.WORKSPACE || path.join(ROOT, 'workspace'));
// 이 주소에서 연 화면(GitHub Pages 등)이 내 PC의 서버에 붙을 수 있다. 쉼표로 여러 개.
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS ?? 'https://ceaser501.github.io').split(',').map((s) => s.trim()).filter(Boolean);

const runner = MODE === 'claude'
  ? createClaudeRunner({
    workspace: WORKSPACE,
    model: process.env.CLAUDE_MODEL || undefined,
    workTools: process.env.ALLOWED_TOOLS ? process.env.ALLOWED_TOOLS.split(',').map((s) => s.trim()) : undefined,
  })
  : createSimRunner({ speed: Number(process.env.SIM_SPEED || 1) });

const engine = createEngine({
  runner,
  mode: MODE,
  maxParallel: Number(process.env.MAX_PARALLEL || (MODE === 'claude' ? 2 : 3)),
  autoDemo: MODE === 'sim' && process.env.AUTO_DEMO !== '0',
  autoAnswerMs: MODE === 'sim' ? 60e3 : 0,
});

try { engine.restore(JSON.parse(await readFile(DATA, 'utf8'))); } catch {}
engine.state.mode = MODE;

// ---------- 상태 저장 & SSE ----------
const clients = new Set();
let saveTimer = null;
engine.subscribe((snap) => {
  const msg = `data: ${JSON.stringify(snap)}\n\n`;
  for (const res of clients) res.write(msg);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await mkdir(path.dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify(engine.snapshot()));
  }, 1500);
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 100e3) throw new Error('too large'); }
  return s ? JSON.parse(s) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
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
  try {
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
      const file = path.join(WORKSPACE, path.normalize(decodeURIComponent(p.slice(6))));
      if (!file.startsWith(WORKSPACE + path.sep)) return json(res, 403, { error: 'forbidden' });
      const data = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || (file.endsWith('.md') ? 'text/plain; charset=utf-8' : 'application/octet-stream'),
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

    const file = path.join(PUBLIC, path.normalize(p === '/' ? '/index.html' : p));
    if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') return json(res, 404, { error: 'not found' });
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
  if (MODE === 'claude') console.log(`작업 폴더: ${WORKSPACE}`);
  if (ALLOW_ORIGINS.length) console.log(`외부 화면 연결 허용: ${ALLOW_ORIGINS.join(', ')}`);
});
