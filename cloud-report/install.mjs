#!/usr/bin/env node
// 사무실 보고 훅 넣기. 이미 있는 다른 훅과 설정은 그대로 두고, 다시 실행해도 두 번 들어가지 않는다.
//   node cloud-report/install.mjs <레포 폴더>   그 레포의 .claude/ 에 (그 레포로 연 세션만 보고)
//   node cloud-report/install.mjs --user        내 ~/.claude/ 에 (이 컴퓨터·이 클라우드 환경의 모든 세션이 보고)
// --user 는 클라우드 환경의 Setup script 에서 쓰도록 만들었다(deploy/README.md 4절).
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const user = process.argv.includes('--user');
const target = user ? os.homedir() : path.resolve(process.argv[2] || '.');
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'PermissionRequest', 'Stop', 'SessionEnd'];
const COMMAND = user ? 'node "$HOME/.claude/hooks/office-report.mjs"' : 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/office-report.mjs"';

const dir = path.join(target, '.claude');
const dest = path.join(dir, 'hooks', 'office-report.mjs');
await mkdir(path.dirname(dest), { recursive: true });
// 보고 스크립트는 옆에 있으면 복사한다. 없으면(Setup script 가 따로 내려받은 경우) 이미 있는 것을 쓴다.
try { await copyFile(path.join(HERE, 'office-report.mjs'), dest); } catch (e) {
  try { await readFile(dest); } catch { console.error(`보고 스크립트가 없어요: ${dest}`); process.exit(1); }
}

const file = path.join(dir, 'settings.json');
let settings = {};
try { settings = JSON.parse(await readFile(file, 'utf8')); } catch (e) {
  if (e.code !== 'ENOENT') { console.error(`${file} 를 읽지 못했어요(JSON 오류?). 고친 뒤 다시 실행하세요: ${e.message}`); process.exit(1); }
}
settings.hooks ||= {};
let added = 0;
for (const ev of EVENTS) {
  const list = (settings.hooks[ev] ||= []);
  if (list.some((g) => (g.hooks || []).some((h) => String(h.command || '').includes('office-report.mjs')))) continue;
  const entry = { hooks: [{ type: 'command', command: COMMAND, timeout: 5 }] };
  if (ev === 'PreToolUse' || ev === 'PostToolUse') entry.matcher = '*';
  list.push(entry);
  added++;
}
await writeFile(file, JSON.stringify(settings, null, 2) + '\n');
console.log(`보고 훅을 넣었어요: ${user ? dir : path.relative(process.cwd(), dir) || dir} (새로 추가한 이벤트 ${added}개)`);
console.log('클라우드 환경 설정에 OFFICE_URL, OFFICE_TOKEN 환경 변수와 네트워크 허용 주소를 넣으면 보고가 시작됩니다.');
