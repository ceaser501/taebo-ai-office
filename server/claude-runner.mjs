// 실제 Claude Code 러너 — `claude -p` 헤드리스 모드를 띄우고 stream-json 이벤트를 엔진으로 넘긴다.
import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const TOOLS = {
  plan: ['Read', 'Glob', 'Grep'],
  work: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite',
    'Bash(git:*)', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(mkdir:*)', 'Bash(python3:*)', 'Bash(python:*)'],
  review: ['Read', 'Glob', 'Grep', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(git:*)'],
  wiki: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
};

export function createClaudeRunner({ workspace, bin = 'claude', model, workTools, timeoutMs = 20 * 60e3 } = {}) {
  return {
    name: 'claude',
    // 일감 폴더의 결과물 목록 (workspace 기준 상대 경로)
    async listFiles(workdir) {
      const entries = await readdir(path.join(workspace, workdir), { recursive: true, withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => path.relative(workspace, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/'))
        .filter((f) => !/(^|\/)(\.git|node_modules|__pycache__)(\/|$)/.test(f))
        .slice(0, 60);
    },
    async run({ kind, prompt, systemPrompt, workdir = '', resumeSessionId, onEvent = () => {} }) {
      const cwd = path.join(workspace, workdir);
      await mkdir(cwd, { recursive: true });
      const tools = kind === 'work' && workTools ? workTools : TOOLS[kind] || TOOLS.work;
      const args = [
        '-p', '--output-format', 'stream-json', '--verbose',
        '--permission-mode', 'acceptEdits',
        '--append-system-prompt', systemPrompt,
        '--allowedTools', tools.join(','),
      ];
      if (model) args.push('--model', model);
      if (resumeSessionId) args.push('--resume', resumeSessionId);

      return new Promise((resolve) => {
        const child = spawn(bin, args, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
        let sessionId = resumeSessionId || null;
        let result = null;
        let lastText = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);

        child.stdin.end(prompt);
        child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
        readline.createInterface({ input: child.stdout }).on('line', (line) => {
          let msg;
          try { msg = JSON.parse(line); } catch { return; }
          if (msg.session_id) sessionId = msg.session_id;
          if (msg.type === 'assistant') {
            for (const c of msg.message?.content || []) {
              if (c.type === 'tool_use') {
                const fp = c.input?.file_path;
                const file = fp ? path.relative(workspace, path.resolve(cwd, fp)).split(path.sep).join('/') : undefined;
                onEvent({ type: 'tool', name: c.name, input: c.input || {}, file: file && !file.startsWith('..') ? file : undefined });
              } else if (c.type === 'text' && c.text?.trim()) { lastText = c.text; onEvent({ type: 'text', text: c.text }); }
            }
          } else if (msg.type === 'result') result = msg;
        });
        child.on('error', (e) => { clearTimeout(timer); resolve({ text: `claude 실행 실패: ${e.message}`, isError: true, sessionId }); });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            text: result?.result ?? (lastText || stderr || `종료 코드 ${code}`),
            sessionId,
            isError: Boolean(result?.is_error) || (code !== 0 && !result),
            costUsd: result?.total_cost_usd || 0,
          });
        });
      });
    },
  };
}
