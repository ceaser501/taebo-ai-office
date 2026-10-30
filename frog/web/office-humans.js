"use strict";
// [태보 추가] 사람 직원 — 원본 그림 시트 규격(docs/SPRITES.md: 칸 220×280, 발끝 = 칸 아래, 같은 칸 순서)을
// 그대로 지켜 브라우저에서 그린다. 가디건은 -key 마스크로 칠해 프로젝트 색이 입혀진다.
// 캐릭터 고르기: 주소 ?species=people|man|woman|frog|capy|mix (고른 값은 기억), 화면 오른쪽 위 버튼.

const OfficeSpecies = (() => {
  const STORE = "office.species";
  const MODES = ["people", "man", "woman", "frog", "capy", "mix"];
  const LISTS = { people: ["man", "woman"], man: ["man"], woman: ["woman"], frog: ["frog"], capy: ["capy"], mix: ["frog", "capy"] };
  const q = new URLSearchParams(location.search).get("species");
  let saved = null;
  try { saved = localStorage.getItem(STORE); } catch { /* 저장 못 해도 화면은 뜬다 */ }
  const mode = MODES.includes(q) ? q : MODES.includes(saved) ? saved : "people";
  if (MODES.includes(q)) { try { localStorage.setItem(STORE, q); } catch { /* 무시 */ } }
  const list = LISTS[mode];
  // 이름이 같으면 늘 같은 캐릭터. mix 는 원본과 같은 규칙(개구리·카피바라)
  function pick(name, hash) {
    if (list.length === 1) return list[0];
    const odd = hash("종:" + name) % 2;
    return mode === "mix" ? (odd ? "capy" : "frog") : (odd ? "woman" : "man");
  }
  function set(next) {
    if (!MODES.includes(next) || next === mode) return;
    try { localStorage.setItem(STORE, next); } catch { /* 무시 */ }
    const url = new URL(location.href);
    url.searchParams.set("species", next);
    location.href = url;
  }
  return { mode, list, pick, set };
})();

const OfficeHumans = (() => {
  const CW = 220, CH = 280, CX = 110, FOOT = 277;
  const SKIN = "#f6d2b6", SKIN_D = "#e2ad88", CARD = "#f4f1eb", CARD_D = "#cfc7ba";
  const SHIRT = "#fffaf1", INK = "#33241d", MOUTH = "#8c3b34";
  const LOOKS = {
    man: { hair: "#33241b", hairL: "#5b4233", style: "short", pants: "#3f5e8e", shoe: "#6c4326" },
    woman: { hair: "#4b2b1d", hairL: "#7b4c34", style: "bob", pants: "#4b6791", shoe: "#8a5337" },
  };
  const TAILS = { "": 8, 2: 8, 3: 8, mini: 8, walk: 20, phone: 8 };
  const BASE = {
    stand: { sh: 158, hip: 224, legs: "stand" },
    sitF: { sh: 190, hip: 252, legs: "sitF" },
    sitB: { sh: 194, hip: 258, legs: "sitB" },
  };

  // ---------- 칠하기: 보통 그림 / 마스크(가디건만 남김) ----------
  function painter(ctx, mask) {
    const use = (kind, style, fn) => {
      ctx.save();
      if (mask) { ctx.globalCompositeOperation = kind === "key" ? "source-over" : "destination-out"; style = "#fff"; }
      fn(style);
      ctx.restore();
    };
    return {
      ctx, mask,
      fill(kind, path, style) { use(kind, style, (s) => { ctx.fillStyle = s; ctx.fill(path); }); },
      stroke(kind, path, style, w) {
        use(kind, style, (s) => { ctx.strokeStyle = s; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(path); });
      },
      grad(fn) { return mask ? "#fff" : fn(ctx); },
    };
  }
  const P2 = () => new Path2D();
  const ellipse = (x, y, rx, ry, rot = 0) => { const p = P2(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
  const rrect = (x, y, w, h, r) => { const p = P2(); p.roundRect(x, y, w, h, r); return p; };
  const poly = (pts) => { const p = P2(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
  const hGrad = (x0, x1, edge, mid) => (c) => {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, edge); g.addColorStop(0.32, mid); g.addColorStop(0.68, mid); g.addColorStop(1, edge);
    return g;
  };
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16), k = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${k(n >> 16)},${k((n >> 8) & 255)},${k(n & 255)})`;
  };

  // ---------- 몸 ----------
  function legs(P, g, look, spec) {
    const pants = look.pants, pd = shade(pants, 0.82), cuff = shade(pants, 1.18);
    if (g.legs === "stand") {
      const order = (spec.r?.lift || 0) > (spec.l?.lift || 0) ? [1, -1] : [-1, 1];
      for (const s of order) {
        const o = (s < 0 ? spec.l : spec.r) || {};
        const x = CX + s * 12 + (o.dx || 0), lift = o.lift || 0, bottom = 263 - lift;
        P.fill("plain", rrect(x - 11, g.hip - 8, 22, bottom - g.hip + 8, 9), P.grad(hGrad(x - 11, x + 11, pd, pants)));
        P.fill("plain", rrect(x - 12, bottom - 7, 24, 8, 3), cuff);
        P.fill("plain", ellipse(x + s * 2, 268 - lift, 14, 8.5), look.shoe);
        P.fill("plain", ellipse(x + s * 2, 272 - lift, 13, 4), shade(look.shoe, 0.7));
      }
    } else if (g.legs === "sitF") {
      for (const s of [-1, 1]) {
        const x = CX + s * 17;
        P.fill("plain", rrect(x - 14, g.hip - 14, 28, 262 - g.hip + 14, 12), P.grad(hGrad(x - 14, x + 14, pd, pants)));
        P.fill("plain", rrect(x - 14, 254, 28, 9, 4), cuff);
        P.fill("plain", ellipse(CX + s * 24, 266, 17, 10.5), look.shoe);
        P.fill("plain", ellipse(CX + s * 24, 271, 15, 5.5), "#d9b48b");
      }
    } else {
      P.fill("plain", rrect(CX - 41, g.hip - 16, 82, 274 - g.hip + 16, 22), P.grad(hGrad(CX - 41, CX + 41, pd, pants)));
      for (const s of [-1, 1]) P.fill("plain", ellipse(CX + s * 35, 271, 11, 6), look.shoe);
    }
  }

  function torsoPath(g) {
    const top = g.sh - 10, bot = g.hip + 6, wt = 33, wb = 38;
    const p = P2();
    p.moveTo(CX - wt + 10, top);
    p.lineTo(CX + wt - 10, top);
    p.quadraticCurveTo(CX + wt + 4, top + 2, CX + wt + 3, top + 18);
    p.lineTo(CX + wb, bot - 10);
    p.quadraticCurveTo(CX + wb, bot, CX + wb - 10, bot);
    p.lineTo(CX - wb + 10, bot);
    p.quadraticCurveTo(CX - wb, bot, CX - wb, bot - 10);
    p.lineTo(CX - wt - 3, top + 18);
    p.quadraticCurveTo(CX - wt - 4, top + 2, CX - wt + 10, top);
    p.closePath();
    return p;
  }

  function torso(P, g) {
    P.fill("plain", rrect(CX - 9, g.sh - 22, 18, 18, 6), SKIN_D);           // 목
    const body = torsoPath(g);
    P.fill("key", body, P.grad(hGrad(CX - 40, CX + 40, CARD_D, CARD)));
    if (g.view === "front") {
      const t = g.turn * 8, top = g.sh - 9, bot = g.hip + 5;
      P.fill("plain", poly([[CX - 10 + t, top], [CX + 10 + t, top], [CX + 13 + t, bot], [CX - 13 + t, bot]]), SHIRT);
      const edge = P2();
      edge.moveTo(CX - 10 + t, top); edge.lineTo(CX - 13 + t, bot);
      edge.moveTo(CX + 10 + t, top); edge.lineTo(CX + 13 + t, bot);
      P.stroke("key", edge, CARD_D, 3);
      for (const dy of [14, 32, 50]) P.fill("plain", ellipse(CX - 15 + t, g.sh + dy, 2.6, 2.6), "#8b6a52");
      P.fill("plain", poly([[CX - 7 + t, top], [CX + 7 + t, top], [CX + t, top + 9]]), SKIN_D);
    } else {
      const seam = P2();
      seam.moveTo(CX, g.sh - 2); seam.lineTo(CX, g.hip + 2);
      P.stroke("key", seam, "rgba(150,140,125,.35)", 1.5);
      const collar = P2();
      collar.moveTo(CX - 22, g.sh - 9); collar.quadraticCurveTo(CX, g.sh - 2, CX + 22, g.sh - 9);
      P.stroke("key", collar, CARD_D, 4);
    }
  }

  // 어깨에서 손까지 두 마디 — 손 위치(어깨 기준)만 주면 팔꿈치는 바깥쪽으로 알아서 굽힌다
  function armGeo(g, s, h) {
    const sx = CX + s * 29, sy = g.sh + 3;
    let tx = CX + h[0], ty = g.sh + h[1];
    const L1 = 31, L2 = 31;
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
    if (d > L1 + L2 - 0.5) { const k = (L1 + L2 - 0.5) / d; tx = sx + dx * k; ty = sy + dy * k; dx *= k; dy *= k; d = L1 + L2 - 0.5; }
    d = Math.max(d, 4);
    const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const base = Math.atan2(dy, dx);
    const cand = [base + a, base - a].map((t) => [sx + Math.cos(t) * L1, sy + Math.sin(t) * L1]);
    const e = cand.sort((p, q) => s * q[0] - s * p[0] || q[1] - p[1])[0];
    return { s: [sx, sy], e, h: [tx, ty] };
  }
  function sleeve(P, A) {
    const p = P2();
    p.moveTo(...A.s); p.lineTo(...A.e); p.lineTo(...A.h);
    P.stroke("key", p, CARD_D, 19.5);
    P.stroke("key", p, CARD, 15.5);
  }
  const hand = (P, A) => { P.fill("plain", ellipse(A.h[0], A.h[1], 8.5, 8.5), SKIN); P.fill("plain", ellipse(A.h[0] - 2, A.h[1] - 2, 4, 3), "rgba(255,255,255,.25)"); };

  // ---------- 머리 ----------
  function hairFront(P, g, look, layer) {
    const { hx, hy } = g, t = g.turn * 6;
    const hairFill = P.grad((c) => { const r = c.createRadialGradient(hx - 14, hy - 40, 6, hx, hy - 10, 70); r.addColorStop(0, look.hairL); r.addColorStop(1, look.hair); return r; });
    if (look.style === "bob" && layer === "back") {
      const p = P2();
      p.moveTo(hx - 58, hy + 36);
      p.lineTo(hx - 58, hy - 6);
      p.ellipse(hx, hy - 6, 58, 56, 0, Math.PI, Math.PI * 2);
      p.lineTo(hx + 58, hy + 36);
      p.quadraticCurveTo(hx, hy + 46, hx - 58, hy + 36);
      P.fill("plain", p, hairFill);
      return;
    }
    if (layer !== "front") return;
    const rx = look.style === "bob" ? 56 : 54, edge = look.style === "bob" ? hy - 10 : hy - 16;
    const p = P2();
    p.moveTo(hx - rx, edge + 10);
    p.ellipse(hx + t * 0.3, hy - 10, rx, 50, 0, Math.PI, Math.PI * 2);
    p.lineTo(hx + rx, edge + 10);
    const n = 5;
    for (let i = n; i >= 0; i--) {
      const x = hx - rx + (2 * rx * i) / n + (i === 0 || i === n ? 0 : t);   // 양 끝은 머리 테두리에 맞춘다
      const y = edge + (i % 2 ? 4 : -4) + (look.style === "bob" ? 4 : 0);
      p.quadraticCurveTo(x + rx / n, y + 8, x, y);
    }
    p.closePath();
    P.fill("plain", p, hairFill);
    if (look.style === "bob") {
      for (const s of [-1, 1]) P.fill("plain", rrect(hx + s * 52 - 9, hy - 12, 18, 48, 9), hairFill);
    } else {
      for (const s of [-1, 1]) P.fill("plain", rrect(hx + s * 49 - 5, hy - 16, 10, 20, 5), hairFill);
    }
  }
  function headFront(P, g, look, f) {
    const { hx, hy } = g;
    for (const s of [-1, 1]) P.fill("plain", ellipse(hx + s * 49 + g.turn * 4, hy + 6, 9, 11), SKIN_D);
    P.fill("plain", ellipse(hx, hy, 50, 49), P.grad((c) => { const r = c.createRadialGradient(hx - 15, hy - 18, 8, hx, hy, 56); r.addColorStop(0, "#fde3cf"); r.addColorStop(1, SKIN_D); return r; }));
    hairFront(P, g, look, "front");
    face(P, g, f);
  }
  function headBack(P, g, look) {
    const { hx, hy } = g;
    for (const s of [-1, 1]) P.fill("plain", ellipse(hx + s * 49, hy + 6, 9, 11), SKIN_D);
    const hairFill = P.grad((c) => { const r = c.createRadialGradient(hx + 10, hy - 30, 6, hx, hy, 70); r.addColorStop(0, look.hairL); r.addColorStop(1, look.hair); return r; });
    if (look.style === "bob") {
      const p = P2();
      p.moveTo(hx - 57, hy + 36); p.lineTo(hx - 57, hy - 4);
      p.ellipse(hx, hy - 4, 57, 55, 0, Math.PI, Math.PI * 2);
      p.lineTo(hx + 57, hy + 36); p.quadraticCurveTo(hx, hy + 46, hx - 57, hy + 36);
      P.fill("plain", p, hairFill);
    } else {
      P.fill("plain", ellipse(hx, hy + 30, 22, 14), SKIN_D);
      P.fill("plain", ellipse(hx, hy - 2, 51, 49), hairFill);
    }
  }
  function face(P, g, f) {
    if (P.mask) return;
    const c = P.ctx, fx = g.hx + g.turn * 12, ey = g.hy + 8 + (f.eyes === "up" ? -3 : 0);
    c.save();
    c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = "round"; c.lineWidth = 3;
    for (const s of [-1, 1]) {
      const ex = fx + s * 17;
      if (f.eyes === "happy") { c.beginPath(); c.arc(ex, ey + 3, 6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else if (f.eyes === "closed") { c.beginPath(); c.arc(ex, ey - 2, 6, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
      else if (f.eyes === "down") { c.beginPath(); c.ellipse(ex, ey + 3, 5, 3.5, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(ex - 6, ey - 1); c.lineTo(ex + 6, ey - 1); c.stroke(); }
      else {
        c.beginPath(); c.ellipse(ex, ey, 5.5, f.eyes === "half" ? 4.5 : 7, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(ex + 1.8 + g.turn * 1.5, ey - (f.eyes === "up" ? 4 : 2.5), 2, 0, Math.PI * 2); c.fill(); c.fillStyle = INK;
      }
      c.lineWidth = 2.6; c.strokeStyle = "#5a3d2e";
      const by = ey - 14 - (f.eyes === "up" ? 3 : 0);
      c.beginPath(); c.moveTo(ex - 6, by + 1); c.quadraticCurveTo(ex, by - 3, ex + 6, by + 1); c.stroke();
      c.strokeStyle = INK; c.lineWidth = 3;
    }
    c.fillStyle = "rgba(240,120,110,.28)";
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(fx + s * 28, g.hy + 22, 9, 5, 0, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = "#c98f6d"; c.lineWidth = 2;
    c.beginPath(); c.arc(fx, g.hy + 16, 3, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
    const my = g.hy + 30;
    c.strokeStyle = MOUTH; c.fillStyle = MOUTH; c.lineWidth = 2.6;
    if (f.mouth === "flat") { c.beginPath(); c.moveTo(fx - 5, my); c.lineTo(fx + 5, my); c.stroke(); }
    else if (f.mouth === "open") { c.beginPath(); c.ellipse(fx, my + 1, 7, 5.5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#e7867c"; c.beginPath(); c.ellipse(fx, my + 3.5, 4, 2.2, 0, 0, Math.PI * 2); c.fill(); }
    else if (f.mouth === "laugh") { c.beginPath(); c.moveTo(fx - 11, my - 3); c.lineTo(fx + 11, my - 3); c.ellipse(fx, my - 3, 11, 10, 0, 0, Math.PI); c.fill(); c.fillStyle = "#e7867c"; c.beginPath(); c.ellipse(fx, my + 3.5, 6, 3, 0, 0, Math.PI * 2); c.fill(); }
    else if (f.mouth === "yawn") { c.beginPath(); c.ellipse(fx, my + 2, 7, 10, 0, 0, Math.PI * 2); c.fill(); }
    else if (f.mouth === "o") { c.beginPath(); c.ellipse(fx, my + 1, 4, 5, 0, 0, Math.PI * 2); c.fill(); }
    else { c.beginPath(); c.arc(fx, my - 5, 8, Math.PI * 0.2, Math.PI * 0.8); c.stroke(); }
    c.restore();
  }

  // ---------- 들고 있는 것 ----------
  function item(P, it, g) {
    if (!it) return;
    const x = CX + it.at[0], y = g.sh + it.at[1];
    if (it.type === "mug") {
      P.fill("plain", rrect(x - 9, y - 10, 17, 20, 4), "#ffffff");
      const h = P2(); h.ellipse(x + 9, y, 5, 6, 0, -Math.PI / 2, Math.PI / 2);
      P.stroke("plain", h, "#ffffff", 3.5);
      P.fill("plain", ellipse(x - 0.5, y - 9, 8, 2.6), "#7b4a2e");
    } else if (it.type === "phone") {
      const p = P2(); p.roundRect(-7, -11, 14, 22, 3);
      const m = new DOMMatrix().translate(x, y).rotate(it.rot || 0);
      const q = P2(); q.addPath(p, m);
      P.fill("plain", q, "#2b2f36");
      const sp = P2(); sp.roundRect(-5.5, -9, 11, 16, 2);
      const qs = P2(); qs.addPath(sp, m);
      P.fill("plain", qs, "#6fb7e6");
    } else if (it.type === "paper") {
      const p = P2(); p.rect(-14, -17, 28, 34);
      const q = P2(); q.addPath(p, new DOMMatrix().translate(x, y).rotate(it.rot || -6));
      P.fill("plain", q, "#ffffff");
      const lines = P2();
      for (const dy of [-8, -2, 4]) { lines.moveTo(-8, dy); lines.lineTo(8, dy); }
      const ql = P2(); ql.addPath(lines, new DOMMatrix().translate(x, y).rotate(it.rot || -6));
      P.stroke("plain", ql, "#c9ced6", 1.5);
    }
  }

  // ---------- 자세 하나 ----------
  function figure(P, look, spec) {
    const b = BASE[spec.base || "stand"];
    const view = spec.view || "front";
    const g = { ...b, view, turn: spec.turn || 0 };
    g.hx = CX + (spec.headDx || 0);
    g.hy = g.sh - 52 + (spec.headDy || 0);
    const c = P.ctx;
    c.save();
    if (spec.lean) { c.translate(CX, FOOT); c.rotate(spec.lean); c.translate(-CX, -FOOT); }
    c.translate(0, -(spec.bob || 0));
    const arms = [-1, 1].map((s) => {
      const a = (s < 0 ? spec.L : spec.R) || { h: [s * 35, 56] };
      return { ...armGeo(g, s, a.h), front: a.front ?? view === "front" };
    });
    if (view === "front") hairFront(P, g, look, "back");
    for (const A of arms) if (!A.front) { sleeve(P, A); hand(P, A); }
    if (g.legs !== "sitF") legs(P, g, look, spec.legs || {});
    torso(P, g);
    if (g.legs === "sitF") legs(P, g, look, spec.legs || {});
    if (view === "front") headFront(P, g, look, { eyes: spec.eyes || "open", mouth: spec.mouth || "smile" });
    else headBack(P, g, look);
    for (const A of arms) if (A.front) sleeve(P, A);
    item(P, spec.item, g);
    for (const A of arms) if (A.front) hand(P, A);
    c.restore();
  }

  // ---------- 시트별 자세 (칸 순서 = office-view.js 의 POSES) ----------
  const L_ = -0.35, R_ = 0.35;
  const stand = { turn: L_, L: { h: [-30, 52] }, R: { h: [30, 52] } };
  const paper2 = { L: { h: [-13, 36] }, R: { h: [13, 36] }, item: { type: "paper", at: [0, 32] } };
  const phone2 = (base) => ({ base, L: { h: [-9, 26] }, R: { h: [9, 26] }, item: { type: "phone", at: [0, 22], rot: 0 }, eyes: "down" });
  function walk(n, back) {
    const ph = (n / 8) * Math.PI * 2, sw = Math.sin(ph);
    return {
      view: back ? "back" : "front", turn: back ? 0 : L_, bob: Math.abs(sw) * 3,
      legs: { l: { dx: sw * 9, lift: Math.max(0, Math.cos(ph)) * 7 }, r: { dx: -sw * 9, lift: Math.max(0, -Math.cos(ph)) * 7 } },
      L: { h: [-36 - sw * 7, 54] }, R: { h: [36 - sw * 7, 54] },
    };
  }
  function miniWalk(k, back) {
    const sw = k ? -1 : 1;
    return {
      view: back ? "back" : "front", turn: back ? 0 : L_, bob: 2,
      legs: { l: { dx: sw * 8, lift: sw > 0 ? 6 : 0 }, r: { dx: -sw * 8, lift: sw < 0 ? 6 : 0 } },
      ...(back ? {} : paper2),
    };
  }
  const SHEETS = {
    "": [
      stand, walk(2), walk(2, true),
      { base: "sitB", view: "back", L: { h: [-30, 30] }, R: { h: [30, 30] } },
      { base: "sitF", lean: -0.04, eyes: "half", L: { h: [-46, 46] }, R: { h: [46, 46] } },
      { turn: L_, L: { h: [-32, 52] }, R: { h: [14, 30] }, item: { type: "mug", at: [14, 26] } },
      stand, stand,
    ],
    2: [
      stand,
      { turn: R_, mouth: "open", R: { h: [56, 4] } },
      { eyes: "happy", mouth: "laugh", bob: 2, L: { h: [-8, 44] }, R: { h: [26, 46] } },
      { eyes: "closed", mouth: "flat", R: { h: [8, -24] }, item: { type: "mug", at: [8, -28] } },
      { eyes: "happy", mouth: "open", R: { h: [50, -60] } },
      { eyes: "up", mouth: "flat", R: { h: [6, -12] }, L: { h: [12, 34] } },
      { mouth: "open", R: { h: [40, -36] }, L: { h: [-52, 12] }, item: { type: "phone", at: [40, -36], rot: -15 } },
      { eyes: "closed", mouth: "yawn", L: { h: [-28, -76] }, R: { h: [28, -76] } },
    ],
    3: [
      stand, { ...stand, turn: 0 }, { ...stand, turn: R_ },
      { view: "back", L: { h: [-34, 54] }, R: { h: [34, 54] } },
      { view: "back", L: { h: [-34, 54] }, R: { h: [34, 54] } },
      { base: "sitB", view: "back", L: { h: [-44, -62], front: true }, R: { h: [44, -62], front: true } },
      { base: "sitB", view: "back", L: { h: [-30, 30] }, R: { h: [26, -82], front: true } },
      { base: "sitF", turn: R_, mouth: "open", lean: -0.03, L: { h: [-46, 46] }, R: { h: [52, 8] } },
    ],
    mini: [
      { ...paper2 }, { ...miniWalk(0), turn: 0 }, { ...miniWalk(1), turn: 0 },
      { eyes: "happy", mouth: "open", L: { h: [-13, 36] }, R: { h: [48, -54] }, item: { type: "paper", at: [-12, 32] } },
      { eyes: "happy", mouth: "open", bob: 8, legs: { l: { lift: 8 }, r: { lift: 8 } }, L: { h: [-52, 2] }, R: { h: [42, -58] }, item: { type: "paper", at: [44, -68], rot: 12 } },
      { turn: R_ * 1.4, legs: { l: { dx: 7, lift: 4 }, r: { dx: -7 } }, L: { h: [-6, 36] }, R: { h: [20, 36] }, item: { type: "paper", at: [8, 32] } },
      { eyes: "closed", mouth: "smile", headDy: 14, L: { h: [-6, 44] }, R: { h: [6, 44] }, item: { type: "paper", at: [0, 42] } },
      { ...paper2 },
    ],
    phone: [
      stand,
      { turn: L_, eyes: "down", L: { h: [-32, 52] }, R: { h: [14, 26] }, item: { type: "phone", at: [14, 20], rot: -8 } },
      { ...phone2("stand"), mouth: "flat" },
      { ...phone2("stand"), eyes: "happy", mouth: "laugh" },
      { base: "sitF", lean: -0.04, eyes: "down", L: { h: [-46, 46] }, R: { h: [18, 20] }, item: { type: "phone", at: [18, 14], rot: -10 } },
      { ...phone2("sitF") },
      { base: "sitB", view: "back", L: { h: [-30, 30] }, R: { h: [40, 12], front: true }, item: { type: "phone", at: [42, 4], rot: 20 } },
      { ...phone2("sitF"), eyes: "happy", mouth: "laugh" },
    ],
    walk: [
      ...Array.from({ length: 8 }, (_, n) => walk(n)),
      ...Array.from({ length: 8 }, (_, n) => walk(n, true)),
      miniWalk(0), miniWalk(1), miniWalk(0, true), miniWalk(1, true),
    ],
  };

  // ---------- 시트 만들기 + 칸별 키 비율 ----------
  function sheet(look, tail, mask) {
    const n = TAILS[tail];
    const cv = document.createElement("canvas");
    cv.width = CW * n; cv.height = CH;
    const ctx = cv.getContext("2d");
    SHEETS[tail].forEach((spec, i) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(i * CW, 0, CW, CH); ctx.clip();
      ctx.translate(i * CW, 0);
      // 마스크는 같은 순서로 그리되 가디건은 칠하고 나머지는 지운다 — 앞에 놓인 손·머리가 가디건을 가린다
      figure(painter(ctx, mask), look, spec);
      ctx.restore();
    });
    return cv;
  }
  function heights(cv, n) {
    const data = cv.getContext("2d").getImageData(0, 0, cv.width, CH).data;
    return Array.from({ length: n }, (_, i) => {
      for (let y = 0; y < CH; y++) {
        for (let x = i * CW; x < (i + 1) * CW; x++) if (data[(y * cv.width + x) * 4 + 3] > 24) return FOOT + 1 - y;
      }
      return 1;
    });
  }

  // species 목록 중 사람인 것만 그려서 { 시트이름: 캔버스 } 로 돌려준다. 아틀라스(키 비율·보폭)도 채운다.
  function build(species, atlas) {
    const out = {};
    for (const sp of species) {
      const look = LOOKS[sp];
      if (!look) continue;
      let standPx = 0;
      for (const tail of Object.keys(TAILS)) {
        const name = sp + tail;
        const art = sheet(look, tail, false);
        const px = heights(art, TAILS[tail]);
        if (tail === "") standPx = px[0];
        out[name] = art;
        out[name + "-key"] = sheet(look, tail, true);
        atlas.heights[name] = px;
      }
      for (const tail of Object.keys(TAILS)) atlas.heights[sp + tail] = atlas.heights[sp + tail].map((h) => +(h / standPx).toFixed(3));
      atlas.strides[sp] = 5.6;
    }
    return out;
  }

  return { build, has: (sp) => !!LOOKS[sp] };
})();
