// 상태·결과물 저장소. SUPABASE_URL·SUPABASE_SECRET_KEY 가 있으면 Supabase(테이블 office_state, 버킷 office-files),
// 없으면 로컬 data/*.json. 무료 서버(Hugging Face Spaces)는 재시작하면 디스크가 비므로 Supabase 를 쓴다.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const typeOf = (f) => TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
const SKIP = /(^|\/)(\.git|node_modules|__pycache__|\.claude)(\/|$)/;

async function walk(root, dir, out = []) {
  let entries = [];
  try { entries = await readdir(path.join(root, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (SKIP.test(rel)) continue;
    if (e.isDirectory()) await walk(root, rel, out);
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function fileStore(dataDir) {
  return {
    kind: 'file',
    async load(id) { try { return JSON.parse(await readFile(path.join(dataDir, `${id}.json`), 'utf8')); } catch { return null; } },
    async save(id, data) { await mkdir(dataDir, { recursive: true }); await writeFile(path.join(dataDir, `${id}.json`), JSON.stringify(data)); },
    async pull() {},
    async push() {},
    async fetchFile() { return null; },
  };
}

function supabaseStore(url, key, bucket) {
  const base = url.replace(/\/+$/, '');
  // 새 비밀 키(sb_secret_…)는 apikey 헤더로만, 옛 service_role JWT 는 Authorization 에도 넣는다
  const auth = { apikey: key, ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const enc = (rel) => rel.split('/').map(encodeURIComponent).join('/');
  async function call(p, init = {}) {
    const res = await fetch(base + p, { ...init, headers: { ...auth, ...(init.headers || {}) } });
    if (!res.ok && res.status !== 404) throw new Error(`Supabase ${init.method || 'GET'} ${p} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res;
  }
  async function list(prefix) {
    const res = await call(`/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    });
    if (!res.ok) return [];
    const out = [];
    for (const item of await res.json()) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(rel); else out.push(...(await list(rel)));    // id 가 없으면 폴더
    }
    return out;
  }
  return {
    kind: 'supabase',
    async load(id) {
      const res = await call(`/rest/v1/office_state?id=eq.${encodeURIComponent(id)}&select=data`);
      const rows = res.ok ? await res.json() : [];
      return rows[0]?.data ?? null;
    },
    async save(id, data) {
      await call('/rest/v1/office_state', {
        method: 'POST',
        headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
      });
    },
    // 로컬에 그 폴더가 없으면(재시작 뒤) 저장소에서 내려받는다
    async pull(root, dir) {
      try { await stat(path.join(root, dir)); return; } catch { /* 없으면 받는다 */ }
      for (const rel of await list(dir)) {
        const res = await call(`/storage/v1/object/${bucket}/${enc(rel)}`);
        if (!res.ok) continue;
        await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
        await writeFile(path.join(root, rel), Buffer.from(await res.arrayBuffer()));
      }
    },
    // since 이후에 바뀐 파일만 올린다
    async push(root, dir, since) {
      for (const rel of await walk(root, dir)) {
        const abs = path.join(root, rel);
        const st = await stat(abs);
        if (st.mtimeMs < since - 2000 || st.size > 45e6) continue;
        await call(`/storage/v1/object/${bucket}/${enc(rel)}`, {
          method: 'POST', headers: { 'content-type': typeOf(rel), 'x-upsert': 'true' }, body: await readFile(abs),
        });
      }
    },
    async fetchFile(rel) {
      const res = await call(`/storage/v1/object/${bucket}/${enc(rel)}`);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    },
  };
}

export function createStore({ dataDir, supabaseUrl, supabaseKey, bucket = 'office-files' }) {
  return supabaseUrl && supabaseKey ? supabaseStore(supabaseUrl, supabaseKey, bucket) : fileStore(dataDir);
}

// 러너를 감싸서, 일을 시작하기 전에 그 일감 폴더를 내려받고 끝나면 바뀐 파일을 올린다
export function syncRunner(runner, store, workspace) {
  if (store.kind === 'file') return runner;
  return {
    ...runner,
    listFiles: runner.listFiles?.bind(runner),
    async run(opts) {
      const dir = opts.workdir || '';
      const folders = dir ? [dir] : [opts.meta?.id, 'wiki'].filter(Boolean);
      for (const d of folders) await store.pull(workspace, d).catch((e) => console.warn('내려받기 실패:', e.message));
      const since = Date.now();
      const res = await runner.run(opts);
      for (const d of dir ? [dir] : ['wiki']) await store.push(workspace, d, since).catch((e) => console.warn('올리기 실패:', e.message));
      return res;
    },
  };
}
