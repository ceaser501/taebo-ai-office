// 밖에서 쓰는 서버용 비밀번호 로그인. OFFICE_PASSWORD 가 없으면 켜지지 않는다(내 PC에서 쓸 때).
// 로그인하면 비밀번호에서 만든 서명을 쿠키로 준다 — 서버에 세션을 따로 저장하지 않는다.
import crypto from 'node:crypto';

const COOKIE = 'office_auth';
const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(error = '', next = '/') {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>태보 사무실 로그인</title><style>
:root{color-scheme:light}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f2ee;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d2433}
form{background:#fff;border:1px solid #e7e3dc;border-radius:14px;padding:28px;width:min(340px,calc(100vw - 32px));box-shadow:0 6px 24px rgba(0,0,0,.05)}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#7a8190;font-size:13px}
input{width:100%;box-sizing:border-box;border:1px solid #e7e3dc;border-radius:8px;padding:10px 12px;font:inherit}
button{margin-top:12px;width:100%;border:0;border-radius:8px;padding:10px;background:#e8833a;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.err{color:#d9473b;margin-top:10px;font-size:13px}</style></head><body>
<form method="post" action="/login"><h1>태보 사무실</h1><p>비밀번호를 넣어 주세요</p>
<input type="hidden" name="next" value="${esc(next)}"><input type="password" name="password" autofocus required autocomplete="current-password">
<button>들어가기</button>${error ? `<div class="err">${esc(error)}</div>` : ''}</form></body></html>`;
}

export function createAuth(password) {
  if (!password) return null;
  const sign = crypto.createHmac('sha256', password).update('taebo-office-login-v1').digest('hex');

  function ok(req) {
    const c = (req.headers.cookie || '').split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`));
    return !!c && same(c.slice(COOKIE.length + 1), sign);
  }

  // /login, /logout 이면 처리하고 true
  async function handle(req, res, url) {
    if (url.pathname === '/logout') {
      res.writeHead(302, { location: '/login', 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` });
      res.end();
      return true;
    }
    if (url.pathname !== '/login') return false;
    const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');
    if (req.method === 'POST') {
      let raw = '';
      for await (const c of req) { raw += c; if (raw.length > 4096) break; }
      const form = new URLSearchParams(raw);
      const next = safeNext(form.get('next'));
      if (same(form.get('password') || '', password)) {
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        res.writeHead(302, { location: next, 'set-cookie': `${COOKIE}=${sign}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax${secure}` });
        res.end();
      } else {
        await new Promise((r) => setTimeout(r, 800));       // 마구 맞혀 보기를 늦춘다
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
        res.end(page('비밀번호가 맞지 않아요', next));
      }
      return true;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page('', safeNext(url.searchParams.get('next'))));
    return true;
  }

  return { ok, handle };
}

export const tokenOk = (req, token) => !!token && same((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), token);
