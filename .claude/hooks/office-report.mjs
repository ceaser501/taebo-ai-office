#!/usr/bin/env node
// Claude Code 세션(클라우드·내 PC) 상태를 사무실 서버로 보낸다. 레포의 .claude/settings.json 훅에서 불린다.
//   OFFICE_URL   사무실 서버 주소 (예: https://계정-taebo-office.hf.space)
//   OFFICE_TOKEN 서버의 OFFICE_TOKEN 과 같은 값
// 둘 중 하나라도 없으면 아무것도 안 한다. 어떤 오류에도 조용히 끝나고(exit 0), Claude 를 기다리게 하지 않는다.
// 프롬프트·파일 내용은 보내지 않는다. 도구 이름과 짧게 자른 인자(파일 이름, 명령 설명 등)만 보낸다.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openSync, closeSync, statSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SERVER = process.env.OFFICE_URL;
const TOKEN = process.env.OFFICE_TOKEN;
if (!SERVER || !TOKEN) process.exit(0);
setTimeout(() => process.exit(0), 4000).unref();

const clip = (s, n) => { const a = Array.from(String(s ?? '').replace(/\s+/g, ' ').trim()); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const base = (p) => String(p ?? '').split(/[\\/]/).filter(Boolean).pop() || '';

// 도구 → 활동 한 줄 (claude-3d-frog-office 의 docs/CONTRACT.md 4절 Act 형식)
function act(name, input = {}) {
  if (name === 'Read') return { k: 'read', a: base(input.file_path) };
  if (['Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) return { k: 'edit', a: base(input.file_path || input.notebook_path) };
  if (name === 'Write') return { k: 'write', a: base(input.file_path) };
  if (name === 'Bash') return { k: 'bash', a: input.description ? clip(input.description, 44) : clip(input.command, 40) };
  if (name === 'Grep') return { k: 'grep', a: clip(input.pattern, 24) };
  if (name === 'Glob') return { k: 'glob', a: clip(input.pattern, 28) };
  if (name === 'WebFetch') { try { return { k: 'fetch', a: new URL(input.url).host }; } catch { return { k: 'fetch', a: '' }; } }
  if (name === 'WebSearch') return { k: 'search', a: clip(input.query, 24) };
  if (name === 'Agent' || name === 'Task') return { k: 'agent', a: clip(input.description, 30) };
  if (name === 'TodoWrite') return { k: 'todo', a: '' };
  if (name === 'Skill') return { k: 'skill', a: clip(input.skill || input.name, 24) };
  if (name.startsWith('mcp__')) return { k: 'mcp', a: name.split('__').pop() };
  return { k: 'tool', a: clip(name, 24) };
}

function payload(h) {
  const event = String(h.hook_event_name || '');
  const remoteId = process.env.CLAUDE_CODE_REMOTE_SESSION_ID || '';
  const body = {
    v: 1,
    sessionId: String(h.session_id || ''),
    event,
    repo: base(process.env.CLAUDE_PROJECT_DIR || h.cwd || process.cwd()),
    where: process.env.CLAUDE_CODE_REMOTE ? 'cloud' : 'local',
    link: remoteId ? `https://claude.ai/code/${remoteId}` : '',
    at: new Date().toISOString(),
  };
  if (h.tool_name) {
    body.act = act(h.tool_name, h.tool_input || {});
    body.toolUseId = String(h.tool_use_id || '');
    if (h.tool_name === 'Agent' || h.tool_name === 'Task') {
      body.sub = { type: clip(h.tool_input?.subagent_type || '', 24), desc: clip(h.tool_input?.description || '', 30) };
    }
  }
  if (event === 'Notification') { body.notify = String(h.notification_type || ''); body.message = clip(h.message, 80); }
  if (event === 'PermissionRequest') body.message = h.tool_name ? `Claude needs your permission to use ${h.tool_name}` : 'Claude needs your permission';
  return body;
}

// 클라우드 컨테이너는 프록시로만 나갈 수 있어서 HTTPS_PROXY 를 따르는 curl 로 보낸다. 기다리지 않고 맡겨 둔다.
function send(body) {
  const url = SERVER.replace(/\/+$/, '') + '/api/report';
  const c = spawn('curl', ['-sS', '-m', '5', '-o', '/dev/null', '-X', 'POST',
    '-H', 'content-type: application/json', '-H', `authorization: Bearer ${TOKEN}`, '-H', 'ngrok-skip-browser-warning: 1', '--data-binary', '@-', url],
  { detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
  c.on('error', () => process.exit(0));
  c.stdin.on('error', () => {});
  c.stdin.end(JSON.stringify(body));
  c.unref();
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { if (raw.length < 1e6) raw += d; });
// 레포 훅과 사용자 훅(~/.claude)이 둘 다 깔려 있으면 같은 사건으로 두 번 불린다 — 먼저 온 쪽만 보낸다
function firstCall(raw) {
  const mark = path.join(os.tmpdir(), `office-report-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`);
  try {
    if (Date.now() - statSync(mark).mtimeMs < 10e3) return false;
    unlinkSync(mark);
  } catch { /* 처음 */ }
  try { closeSync(openSync(mark, 'wx')); return true; } catch { return false; }
}

process.stdin.on('end', () => {
  try {
    if (!firstCall(raw)) return;
    const body = payload(JSON.parse(raw || '{}'));
    if (body.sessionId) send(body);
  } catch { /* 조용히 */ }
});
process.stdin.on('error', () => process.exit(0));
