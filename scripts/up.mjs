#!/usr/bin/env node
// 내 맥에서 사무실 서버 + ngrok 고정 주소를 한 번에 띄운다:  npm run up   (끄기: Ctrl+C)
// 설정은 레포 맨 위의 .env (.env.example 을 복사해서 채운다). .env 는 git 에 올라가지 않는다.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env 읽기 — 이미 셸에 있는 값이 우선. 빈 값은 없는 것으로 친다.
const env = { ...process.env };
try {
  for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (env[m[1]] === undefined) env[m[1]] = v;
  }
} catch { /* .env 가 없으면 셸 환경만 쓴다 */ }
for (const k of Object.keys(env)) if (env[k] === '') delete env[k];
env.MODE ||= 'claude';
const PORT = env.PORT || '4300';
const DOMAIN = (env.NGROK_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

const stop = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };
if (DOMAIN) {
  if (!env.OFFICE_PASSWORD) stop('밖에 공개하려면 .env 에 OFFICE_PASSWORD(화면 비밀번호)를 꼭 넣어야 해요.');
  if (!env.OFFICE_TOKEN) stop('.env 에 OFFICE_TOKEN(세션 보고 토큰)을 넣어 주세요. 비밀번호와 다른 값으로요.');
  if (env.OFFICE_TOKEN === env.OFFICE_PASSWORD) stop('OFFICE_TOKEN 은 OFFICE_PASSWORD 와 다른 값이어야 해요.');
  const v = spawnSync('ngrok', ['version'], { encoding: 'utf8' });
  if (v.error) stop('ngrok 이 없어요. 설치: brew install ngrok   그다음: ngrok config add-authtoken <대시보드의 토큰>');
}

const kids = [];
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
kids.push(server);

if (process.platform === 'darwin') {
  // 서버가 켜져 있는 동안 맥이 잠들지 않게 (화면은 꺼져도 됨)
  kids.push(spawn('caffeinate', ['-i', '-w', String(server.pid)], { stdio: 'ignore' }));
}

if (DOMAIN) {
  const ngrok = spawn('ngrok', ['http', `--url=${DOMAIN}`, PORT, '--log=stdout', '--log-level=warn'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  kids.push(ngrok);
  ngrok.on('exit', (code) => { if (!stopping) { console.error(`\nngrok 이 꺼졌어요(코드 ${code}). 도메인·토큰 설정을 확인하세요: ngrok config check`); shutdown(1); } });
  setTimeout(() => {
    console.log(`
──────────────────────────────────────────────
 밖에서 접속:  https://${DOMAIN}/          (태보 사무실)
              https://${DOMAIN}/people/   (사람 사무실)
 클라우드 세션 환경 변수:  OFFICE_URL=https://${DOMAIN}
 네트워크 허용 주소:       ${DOMAIN}
 끄기: Ctrl+C
──────────────────────────────────────────────`);
  }, 1500);
} else {
  setTimeout(() => console.log(`\n(내 PC에서만 열려요. 밖에서 쓰려면 .env 에 NGROK_DOMAIN 을 넣으세요)`), 1500);
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const k of kids) { try { k.kill('SIGTERM'); } catch { /* 이미 꺼짐 */ } }
  setTimeout(() => process.exit(code), 300);
}
server.on('exit', (code) => { if (!stopping) shutdown(code ?? 0); });
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
