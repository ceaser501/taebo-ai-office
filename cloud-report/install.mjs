#!/usr/bin/env node
// 다른 레포에 사무실 보고 훅을 넣는다: node cloud-report/install.mjs <레포 폴더>
//   <레포>/.claude/hooks/office-report.mjs 를 복사하고, <레포>/.claude/settings.json 의 hooks 에 보고 훅을 "추가"한다.
//   이미 있는 다른 훅과 설정은 그대로 둔다. 다시 실행해도 두 번 들어가지 않는다.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(process.argv[2] || '.');
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'PermissionRequest', 'Stop', 'SessionEnd'];
const COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/office-report.mjs"';

const dir = path.join(target, '.claude');
await mkdir(path.join(dir, 'hooks'), { recursive: true });
await copyFile(path.join(HERE, 'office-report.mjs'), path.join(dir, 'hooks', 'office-report.mjs'));

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
console.log(`보고 훅을 넣었어요: ${path.relative(process.cwd(), dir) || dir} (새로 추가한 이벤트 ${added}개)`);
console.log('클라우드 환경 설정에 OFFICE_URL, OFFICE_TOKEN 환경 변수와 네트워크 허용 주소를 넣으면 보고가 시작됩니다.');
