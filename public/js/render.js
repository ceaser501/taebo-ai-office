// 아이소메트릭 사무실 캔버스 렌더러 — 바닥, 벽, 가구, 직원 캐릭터, 말풍선을 그린다.
import { FLOORS, findPath, roomAt } from './map.js';

const WALL_H = { outer: 1.9, inner: 0.85, glass: 1.15 };
const SPEED = 3.1; // 칸/초
const ELEVATOR_MS = 1400;

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * (pct < 0 ? v : 255 - v))));
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

const BOOK = ['#c0563f', '#3f6fb0', '#d9a43b', '#4f8f5a', '#7d5aa6', '#e2d3b5', '#2f4858', '#b9774a'];
const NOTE = ['#ffe17a', '#ffb3c1', '#a8d8ff', '#b8f0b0', '#ffcf99'];

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.floor = 1;
    this.sprites = new Map();
    this.occ = new Map();
    this.selected = null;
    this.hover = null;
    this.layer = null;
    this.zoom = 1;
    this.pan = [0, 0];
    this.itemAt = {};
    for (const [id, f] of Object.entries(FLOORS)) this.itemAt[id] = new Map(f.items.map((it) => [`${it.x},${it.y}`, it]));
    this.ceo = { id: 'ceo', name: '대표님', role: 'ceo', color: '#2d3340', hair: '#1c1c1c' };
    new ResizeObserver(() => { this.layer = null; }).observe(canvas);
  }

  setFloor(id) { this.floor = Number(id); this.layer = null; }

  // ---------- 상태 동기화 & 이동 ----------
  sync(agents) {
    for (const a of agents) {
      let s = this.sprites.get(a.id);
      if (!s) {
        s = { id: a.id, floor: a.floor, x: 0, y: 0, path: [], t: Math.random() * 10, face: 'front', flip: false };
        const sp = this.allocSpot(a.floor, a.room, a.id);
        s.x = sp.x + 0.5; s.y = sp.y + 0.5; s.target = { floor: a.floor, spot: sp };
        s.goal = `${a.floor}|${a.room}`;
        this.sprites.set(a.id, s);
      }
      s.agent = a;
      const goal = `${a.floor}|${a.room}`;
      if (goal !== s.goal) { s.goal = goal; this.route(s, a.floor, a.room); }
    }
  }

  route(s, floor, room) {
    for (const [k, v] of this.occ) if (v === s.id) this.occ.delete(k);
    const spot = this.allocSpot(floor, room, s.id);
    s.target = { floor, spot };
    if (s.hiddenUntil) { s.pendingFloor = floor; return; }
    if (s.floor === floor) { s.pendingFloor = null; s.path = this.pathTo(s, floor, spot); }
    else { s.pendingFloor = floor; s.path = this.pathTo(s, s.floor, FLOORS[s.floor].elevator); }
  }

  pathTo(s, floor, cell) {
    const p = findPath(FLOORS[floor], Math.floor(s.x), Math.floor(s.y), cell.x, cell.y);
    return p ?? [[cell.x, cell.y]];
  }

  allocSpot(floor, room, id) {
    const f = FLOORS[floor];
    const seat = f.seats[id];
    if (seat && roomAt(f, seat[0], seat[1])?.id === room) {
      this.occ.set(`${floor}:${seat[0]},${seat[1]}`, id);
      return { x: seat[0], y: seat[1], face: 'back' };
    }
    const reserved = new Set(Object.entries(f.seats).filter(([k]) => k !== id).map(([, [x, y]]) => `${x},${y}`));
    const list = f.spots[room] || [];
    const h = hash(id);
    for (let i = 0; i < list.length; i++) {
      const sp = list[(h + i) % list.length];
      const k = `${floor}:${sp.x},${sp.y}`;
      if (!this.occ.has(k) && !reserved.has(`${sp.x},${sp.y}`)) { this.occ.set(k, id); return sp; }
    }
    const r = f.rooms.find((x) => x.id === room) || f.rooms[0];
    for (let i = 0; i < 60; i++) {
      const x = r.x + Math.floor(Math.random() * r.w), y = r.y + Math.floor(Math.random() * r.h);
      if (!f.blocked.has(`${x},${y}`) && !this.occ.has(`${floor}:${x},${y}`)) { this.occ.set(`${floor}:${x},${y}`, id); return { x, y, face: 'front' }; }
    }
    return { x: r.x, y: r.y, face: 'front' };
  }

  update(dt, now) {
    for (const s of this.sprites.values()) {
      s.t += dt;
      if (s.hiddenUntil) {
        if (now < s.hiddenUntil) continue;
        s.hiddenUntil = 0;
        s.floor = s.pendingFloor ?? s.target.floor;
        s.pendingFloor = null;
        const el = FLOORS[s.floor].elevator;
        s.x = el.x + 0.5; s.y = el.y + 0.5;
        if (s.floor !== s.target.floor) { s.pendingFloor = s.target.floor; s.path = []; }
        else s.path = this.pathTo(s, s.floor, s.target.spot);
        continue;
      }
      if (s.path.length) {
        const [cx, cy] = s.path[0];
        const dx = cx + 0.5 - s.x, dy = cy + 0.5 - s.y;
        const d = Math.hypot(dx, dy), step = SPEED * dt;
        if (step >= d) { s.x = cx + 0.5; s.y = cy + 0.5; s.path.shift(); }
        else { s.x += (dx / d) * step; s.y += (dy / d) * step; }
        s.walking = true;
        if (Math.abs(dx - dy) > 0.01) s.flip = dx - dy < 0;
        s.face = dx + dy < -0.01 ? 'back' : 'front';
      } else {
        s.walking = false;
        if (s.pendingFloor != null && s.pendingFloor !== s.floor) { s.hiddenUntil = now + ELEVATOR_MS; continue; }
        s.face = s.target?.spot?.face ?? 'front';
        s.flip = false;
      }
    }
  }

  floorCounts() {
    const c = { 1: 0, 2: 0, 3: 0 };
    for (const s of this.sprites.values()) c[s.pendingFloor ?? s.floor]++;
    return c;
  }

  // ---------- 좌표 ----------
  fit() {
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr); this.layer = null;
    }
    const f = FLOORS[this.floor];
    const span = f.w + f.h;
    const a = Math.min((cw - 24) / span, (ch - 24) / (span / 2 + 2.9));
    this.dpr = dpr; this.cw = cw; this.ch = ch;
    // 화면 중심 기준으로 확대하고, 끌어서 옮긴 만큼 더한다
    const z = this.zoom, [px, py] = this.pan;
    this.a = a * z;
    this.ox = cw / 2 + (cw / 2 - ((f.w - f.h) / 2) * a - cw / 2) * z + px;
    this.oy = ch / 2 + ((ch - (span / 2 + 2.4) * a) / 2 + 2.0 * a - ch / 2) * z + py;
  }

  // (mx, my) 지점이 그대로 있도록 확대·축소
  zoomAt(factor, mx = this.cw / 2, my = this.ch / 2) {
    const z1 = this.zoom, z2 = Math.max(1, Math.min(3.5, z1 * factor));
    if (z2 === z1) return;
    const keep = (m, c, p) => (m - c) - (z2 * (m - c - p)) / z1;
    this.pan = [keep(mx, this.cw / 2, this.pan[0]), keep(my, this.ch / 2, this.pan[1])];
    this.zoom = z2;
    if (z2 === 1) this.pan = [0, 0];
  }

  panBy(dx, dy) { if (this.zoom > 1) this.pan = [this.pan[0] + dx, this.pan[1] + dy]; }

  resetView() { this.zoom = 1; this.pan = [0, 0]; }

  iso(x, y, z = 0) { return [this.ox + (x - y) * this.a, this.oy + ((x + y) * this.a) / 2 - z * this.a]; }

  poly(ctx, pts, fill, stroke, lw = 1) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  // 상자: 윗면 + 앞-왼쪽(y1) + 앞-오른쪽(x1) 면. 각 면의 꼭짓점을 돌려줘서 장식에 쓴다.
  box(ctx, x0, y0, x1, y1, z0, z1, color, o = {}) {
    const I = (x, y, z) => this.iso(x, y, z);
    const left = [I(x0, y1, z0), I(x1, y1, z0), I(x1, y1, z1), I(x0, y1, z1)];
    const right = [I(x1, y1, z0), I(x1, y0, z0), I(x1, y0, z1), I(x1, y1, z1)];
    const top = [I(x0, y0, z1), I(x1, y0, z1), I(x1, y1, z1), I(x0, y1, z1)];
    const edge = o.stroke ?? 'rgba(60,45,30,.18)';
    this.poly(ctx, left, o.left ?? shade(color, -10), edge, 0.6);
    this.poly(ctx, right, o.right ?? shade(color, -22), edge, 0.6);
    this.poly(ctx, top, o.top ?? color, edge, 0.6);
    return { left, right, top };
  }

  // 면 위 (u,v) 위치 — u: 가로 0..1, v: 세로 0..1(아래→위)
  fp(face, u, v) {
    const [p0, p1, p2, p3] = face;
    const bx = p0[0] + (p1[0] - p0[0]) * u, by = p0[1] + (p1[1] - p0[1]) * u;
    const tx = p3[0] + (p2[0] - p3[0]) * u, ty = p3[1] + (p2[1] - p3[1]) * u;
    return [bx + (tx - bx) * v, by + (ty - by) * v];
  }

  rect(ctx, face, u0, v0, u1, v1, fill, stroke) {
    this.poly(ctx, [this.fp(face, u0, v0), this.fp(face, u1, v0), this.fp(face, u1, v1), this.fp(face, u0, v1)], fill, stroke, 0.6);
  }

  // ---------- 바닥 레이어 (캐시) ----------
  drawFloorLayer() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const ctx = c.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const f = FLOORS[this.floor];
    const I = (x, y, z) => this.iso(x, y, z);
    const sl = -0.42;
    this.poly(ctx, [I(0, f.h, 0), I(f.w, f.h, 0), I(f.w, f.h, sl), I(0, f.h, sl)], '#ddd3c5');
    this.poly(ctx, [I(f.w, 0, 0), I(f.w, f.h, 0), I(f.w, f.h, sl), I(f.w, 0, sl)], '#cbbfae');
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const r = roomAt(f, x, y);
      const base = r?.color || f.corridor;
      const alt = (x + y) % 2 ? shade(base, r?.marble ? 2 : -2.5) : base;
      this.poly(ctx, [I(x, y), I(x + 1, y), I(x + 1, y + 1), I(x, y + 1)], alt, r?.tile ? 'rgba(80,90,110,.16)' : 'rgba(90,70,40,.05)', 0.7);
    }
    // 러그
    const rugs = { 1: [[7, 8, 13, 12, '#d9c8b0'], [21, 2, 24, 5, '#d8c7ad'], [1, 19, 4, 22, '#e3d6c3']], 2: [[6, 9, 16, 12, '#e3d3bb']], 3: [[5, 4, 8, 7, '#d9cbb5'], [12, 4, 15, 7, '#d9cbb5'], [8, 1, 13, 4, '#cdb99a']] }[this.floor] || [];
    for (const [x0, y0, x1, y1, col] of rugs) this.poly(ctx, [I(x0 + 0.1, y0 + 0.1), I(x1 - 0.1, y0 + 0.1), I(x1 - 0.1, y1 - 0.1), I(x0 + 0.1, y1 - 0.1)], col + 'aa');
    return c;
  }

  // ---------- 벽 ----------
  drawWall(ctx, w, now) {
    const H = WALL_H[w.style];
    const outer = w.style === 'outer';
    let b;
    if (w.kind === 'h') b = outer && w.y === 0 ? [w.x, -0.12, w.x + 1, 0] : [w.x, w.y - 0.05, w.x + 1, w.y + 0.05];
    else b = outer && w.x === 0 ? [-0.12, w.y, 0, w.y + 1] : [w.x - 0.05, w.y, w.x + 0.05, w.y + 1];
    if (w.style === 'glass') {
      const f = this.box(ctx, ...b, 0, H, '#cfe3ef', { top: 'rgba(120,160,190,.7)', left: 'rgba(185,215,235,.28)', right: 'rgba(160,195,220,.3)', stroke: 'rgba(120,160,190,.35)' });
      this.rect(ctx, f.left, 0, 0, 1, 0.12, 'rgba(140,170,190,.35)');
      return;
    }
    const f = this.box(ctx, ...b, 0, H, '#f5f0e8', { top: '#d6cdbf', left: '#f7f3ed', right: '#e8e1d6', stroke: 'rgba(120,100,80,.15)' });
    this.rect(ctx, w.kind === 'h' ? f.left : f.right, 0, 0, 1, outer ? 0.05 : 0.09, '#d9cfc0');
    if (w.window) {
      const face = f.left;
      const r = mulberry(w.x * 31 + 7);
      this.rect(ctx, face, 0.05, 0.14, 0.95, 0.94, '#cfe7f7');
      this.rect(ctx, face, 0.05, 0.14, 0.95, 0.5, '#e6f2fa');
      for (let i = 0; i < 3; i++) {
        const u = 0.08 + i * 0.3 + r() * 0.05, hgt = 0.35 + r() * 0.45;
        this.rect(ctx, face, u, 0.14, u + 0.22, 0.14 + hgt * 0.78, i % 2 ? '#9db4c8' : '#8ba5bb');
        for (let k = 0; k < 4; k++) this.rect(ctx, face, u + 0.04, 0.2 + k * 0.12, u + 0.18, 0.24 + k * 0.12, 'rgba(255,240,190,.55)');
      }
      this.rect(ctx, face, 0.48, 0.14, 0.52, 0.94, '#e9e3da');
    }
  }

  drawElevator(ctx, f) {
    const { wallY: wy } = f.elevator;
    const x = 0.01;
    const face = [this.iso(x, wy + 1.9, 0), this.iso(x, wy + 0.1, 0), this.iso(x, wy + 0.1, 1.55), this.iso(x, wy + 1.9, 1.55)];
    this.poly(ctx, face, '#b8bec7', 'rgba(70,80,90,.5)', 1);
    this.rect(ctx, face, 0.06, 0, 0.94, 0.9, '#d7dce3', 'rgba(90,100,110,.35)');
    this.rect(ctx, face, 0.495, 0, 0.505, 0.9, '#8f98a3');
    const moving = [...this.sprites.values()].some((s) => s.hiddenUntil && (s.floor === this.floor || s.pendingFloor === this.floor));
    const [lx, ly] = this.fp(face, 0.5, 0.955);
    ctx.fillStyle = moving ? '#ff9a3c' : '#5b6470';
    ctx.beginPath(); ctx.arc(lx, ly, this.a * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- 가구 ----------
  drawItem(ctx, it, now, active) {
    const { x, y } = it;
    const r = mulberry(hash(`${this.floor}:${x},${y}`));
    const B = (...a) => this.box(ctx, ...a);
    switch (it.kind) {
      case 'shelf': {
        const h = it.short ? 0.9 : 1.55;
        const f = it.face === 'E' ? B(x + 0.1, y + 0.05, x + 0.9, y + 0.95, 0, h, '#8a5a3a') : B(x + 0.05, y + 0.1, x + 0.95, y + 0.9, 0, h, '#8a5a3a');
        const face = it.face === 'E' ? f.right : f.left;
        this.rect(ctx, face, 0.05, 0.03, 0.95, 0.97, '#5e3c26');
        const levels = it.short ? 2 : 4;
        for (let l = 0; l < levels; l++) {
          const v0 = 0.05 + (l * 0.92) / levels, v1 = v0 + 0.92 / levels - 0.05;
          let u = 0.08;
          while (u < 0.9) {
            const w = 0.06 + r() * 0.06;
            this.rect(ctx, face, u, v0, Math.min(0.92, u + w), v0 + (v1 - v0) * (0.7 + r() * 0.3), BOOK[Math.floor(r() * BOOK.length)]);
            u += w + 0.01;
          }
        }
        break;
      }
      case 'desk': case 'console': {
        B(x + 0.06, y + 0.12, x + 0.94, y + 0.88, 0, 0.44, it.kind === 'console' ? '#9aa3ad' : '#d9b78f');
        if (it.divider) B(x + 0.02, y + 0.04, x + 0.98, y + 0.1, 0.44, 0.82, '#cdd5dc');
        if (it.mon === 'S' || it.mon === 'E') this.monitor(ctx, x, y, it, active, now);
        if (it.prop === 'magnifier') {
          const [px, py] = this.iso(x + 0.6, y + 0.6, 0.62);
          ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = this.a * 0.05;
          ctx.beginPath(); ctx.moveTo(px + this.a * 0.08, py + this.a * 0.08); ctx.lineTo(px + this.a * 0.22, py + this.a * 0.2); ctx.stroke();
          ctx.fillStyle = 'rgba(190,225,245,.8)'; ctx.strokeStyle = '#555'; ctx.lineWidth = this.a * 0.035;
          ctx.beginPath(); ctx.arc(px, py, this.a * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        if (it.prop === 'scale') {
          B(x + 0.45, y + 0.45, x + 0.55, y + 0.55, 0.44, 1.0, '#c9a24a');
          B(x + 0.15, y + 0.47, x + 0.85, y + 0.53, 0.98, 1.02, '#c9a24a');
          for (const u of [0.2, 0.8]) { const [px, py] = this.iso(x + u, y + 0.5, 0.82); ctx.fillStyle = '#e3c46e'; ctx.beginPath(); ctx.ellipse(px, py, this.a * 0.14, this.a * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        break;
      }
      case 'ceodesk': {
        const f = B(x, y + 0.1, x + 1, y + 0.9, 0, 0.5, '#5b3a25');
        this.rect(ctx, f.left, 0, 0.82, 1, 0.9, '#c9a24a');
        if (it.mon) B(x + 0.15, y + 0.62, x + 0.85, y + 0.7, 0.5, 0.95, '#23272e');
        break;
      }
      case 'chair': {
        const col = it.big ? '#2e2a28' : '#3c4350';
        B(x + 0.46, y + 0.46, x + 0.54, y + 0.54, 0, 0.2, '#666');
        B(x + 0.28, y + 0.28, x + 0.72, y + 0.72, 0.2, 0.3, col);
        if (it.back === 'N' || it.big) B(x + 0.28, y + 0.24, x + 0.72, y + 0.32, 0.3, it.big ? 1.05 : 0.72, col);
        else B(x + 0.28, y + 0.68, x + 0.72, y + 0.76, 0.3, 0.72, col);
        break;
      }
      case 'sofa': {
        B(x + 0.03, y + 0.12, x + 0.97, y + 0.88, 0, 0.32, it.color);
        if (it.back === 'N') B(x + 0.03, y + 0.08, x + 0.97, y + 0.3, 0.32, 0.75, shade(it.color, -8));
        else B(x + 0.03, y + 0.7, x + 0.97, y + 0.92, 0.32, 0.75, shade(it.color, -8));
        break;
      }
      case 'table': {
        const h = it.low ? 0.3 : 0.45;
        if (it.round) {
          B(x + 0.45, y + 0.45, x + 0.55, y + 0.55, 0, h, '#888');
          const [px, py] = this.iso(x + 0.5, y + 0.5, h);
          ctx.fillStyle = it.color; ctx.strokeStyle = 'rgba(60,45,30,.25)';
          ctx.beginPath(); ctx.ellipse(px, py, this.a * 0.5, this.a * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          break;
        }
        const i = it.full ? 0 : 0.08;
        B(x + i, y + i, x + 1 - i, y + 1 - i, 0, h, it.color, it.full ? { stroke: 'transparent' } : {});
        if (this.floor === 1 && it.full && y === 9 && (x === 9 || x === 11)) this.laptop(ctx, x + 0.5, y + 0.6, h);
        break;
      }
      case 'rack': {
        const f = B(x + 0.08, y + 0.12, x + 0.92, y + 0.88, 0, 1.6, '#2b303b');
        for (let row = 0; row < 7; row++) {
          this.rect(ctx, f.left, 0.08, 0.06 + row * 0.13, 0.92, 0.15 + row * 0.13, '#3a414e');
          for (let c = 0; c < 3; c++) {
            const on = (Math.sin(now / (300 + r() * 500) + r() * 9) > -0.2);
            const col = on ? (c === 2 ? '#60a5fa' : '#4ade80') : '#25303a';
            this.rect(ctx, f.left, 0.12 + c * 0.08, 0.09 + row * 0.13, 0.17 + c * 0.08, 0.12 + row * 0.13, col);
          }
        }
        break;
      }
      case 'plant': {
        B(x + 0.32, y + 0.32, x + 0.68, y + 0.68, 0, 0.34, '#d7c6ae');
        const greens = ['#4f9a52', '#5fb35f', '#3f8a46', '#6cc06a'];
        for (let i = 0; i < 6; i++) {
          const [px, py] = this.iso(x + 0.5 + (r() - 0.5) * 0.4, y + 0.5 + (r() - 0.5) * 0.4, 0.55 + r() * 0.55);
          ctx.fillStyle = greens[i % 4];
          ctx.beginPath(); ctx.arc(px, py, this.a * (0.16 + r() * 0.1), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'vending': {
        const col = it.color || '#d9434a';
        const f = B(x + 0.1, y + 0.2, x + 0.9, y + 0.85, 0, 1.45, col);
        this.rect(ctx, f.left, 0.08, 0.35, 0.68, 0.92, '#d8eef8');
        for (let rr = 0; rr < 4; rr++) for (let c = 0; c < 4; c++) this.rect(ctx, f.left, 0.12 + c * 0.14, 0.4 + rr * 0.13, 0.2 + c * 0.14, 0.48 + rr * 0.13, BOOK[(rr * 4 + c) % BOOK.length]);
        this.rect(ctx, f.left, 0.12, 0.08, 0.68, 0.22, '#2a2a2a');
        this.rect(ctx, f.left, 0.75, 0.5, 0.9, 0.75, '#eee');
        break;
      }
      case 'counter': {
        const f = B(x + 0.02, y + 0.15, x + 0.98, y + 0.85, 0, 0.62, '#f4f1ec');
        this.rect(ctx, f.left, 0, 0.55, 1, 0.75, it.front ? '#c79b6d' : '#e2d9cc');
        if (it.coffee) {
          B(x + 0.25, y + 0.3, x + 0.65, y + 0.65, 0.62, 1.0, '#2f2f33');
          const [px, py] = this.iso(x + 0.75, y + 0.6, 0.7);
          ctx.fillStyle = '#fff'; ctx.fillRect(px - this.a * 0.05, py - this.a * 0.1, this.a * 0.1, this.a * 0.1);
        }
        break;
      }
      case 'boxes': {
        const f = B(x + 0.1, y + 0.1, x + 0.9, y + 0.9, 0, 0.45, '#c89a62');
        this.rect(ctx, f.left, 0.45, 0, 0.55, 1, '#e9d2a6');
        if (it.tall) B(x + 0.18, y + 0.15, x + 0.82, y + 0.8, 0.45, 0.85, '#d3a76c');
        break;
      }
      case 'globe': {
        B(x + 0.44, y + 0.44, x + 0.56, y + 0.56, 0, 0.55, '#7b5a3a');
        const [px, py] = this.iso(x + 0.5, y + 0.5, 0.85);
        ctx.fillStyle = '#5aa7d8'; ctx.beginPath(); ctx.arc(px, py, this.a * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7cc36a';
        for (const [dx, dy, rr] of [[-0.1, -0.08, 0.1], [0.1, 0.06, 0.08], [0.02, -0.15, 0.06]]) { ctx.beginPath(); ctx.arc(px + dx * this.a, py + dy * this.a, rr * this.a, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = this.a * 0.04;
        ctx.beginPath(); ctx.arc(px, py, this.a * 0.36, Math.PI * 0.6, Math.PI * 1.9); ctx.stroke();
        break;
      }
      case 'screen': case 'board': {
        const f = FLOORS[this.floor];
        const same = (dx) => f.items.some((o) => o.kind === it.kind && o.x === x + dx && o.y === y);
        const u0 = same(-1) ? 0 : 0.04, u1 = same(1) ? 1 : 0.96;
        const isBoard = it.kind === 'board';
        const bx = B(x, y + 0.04, x + 1, y + 0.12, isBoard ? 0.25 : 0.4, 1.35, isBoard ? '#f2f2f0' : '#2a2f38', { stroke: 'transparent' });
        if (isBoard) {
          this.rect(ctx, bx.left, u0, 0.06, u1, 0.94, '#ffffff', 'rgba(0,0,0,.08)');
          for (let i = 0; i < 4; i++) {
            const u = 0.1 + r() * 0.7, v = 0.2 + r() * 0.6;
            this.rect(ctx, bx.left, u, v, u + 0.13, v + 0.15, NOTE[Math.floor(r() * NOTE.length)]);
          }
        } else {
          this.rect(ctx, bx.left, u0, 0.08, u1, 0.92, '#1d6fa8');
          for (let i = 0; i < 5; i++) { const u = 0.1 + r() * 0.7, v = 0.2 + r() * 0.5; this.rect(ctx, bx.left, u, v, u + 0.15, v + 0.12, '#58b26a'); }
        }
        break;
      }
      default:
        B(x + 0.1, y + 0.1, x + 0.9, y + 0.9, 0, 0.4, '#bbb');
    }
  }

  monitor(ctx, x, y, it, active, now) {
    const z0 = 0.44;
    const glow = active ? '#8fd3ff' : '#4d6b85';
    const draw = (x0, y0, x1, y1, faceKey) => {
      const f = this.box(ctx, x0, y0, x1, y1, z0 + 0.04, z0 + 0.4, '#23272e');
      const face = f[faceKey];
      this.rect(ctx, face, 0.08, 0.1, 0.92, 0.9, glow);
      if (active) for (let i = 0; i < 4; i++) {
        const w = 0.3 + ((Math.sin(now / 400 + i * 1.7 + x) + 1) / 2) * 0.45;
        this.rect(ctx, face, 0.14, 0.72 - i * 0.16, 0.14 + w * 0.7, 0.78 - i * 0.16, ['#1d4f7a', '#ffffff', '#ffd27a', '#7ee0a8'][i]);
      }
    };
    if (it.mon === 'E') { draw(x + 0.22, y + 0.2, x + 0.3, y + 0.8, 'right'); return; }
    if (it.dual) { draw(x + 0.1, y + 0.22, x + 0.48, y + 0.3, 'left'); draw(x + 0.52, y + 0.22, x + 0.9, y + 0.3, 'left'); }
    else draw(x + 0.2, y + 0.22, x + 0.8, y + 0.3, 'left');
  }

  laptop(ctx, x, y, z) {
    this.box(ctx, x - 0.2, y - 0.15, x + 0.2, y + 0.15, z, z + 0.03, '#c8ccd2');
    const f = this.box(ctx, x - 0.2, y - 0.17, x + 0.2, y - 0.13, z + 0.03, z + 0.3, '#c8ccd2');
    this.rect(ctx, f.left, 0.08, 0.1, 0.92, 0.9, '#8fd3ff');
  }

  // ---------- 캐릭터 ----------
  drawPerson(ctx, px, py, p, o) {
    const u = this.a * 1.3;
    const bob = o.walking ? Math.abs(Math.sin(o.t * 11)) * 0.06 * u : Math.sin(o.t * 2.2) * 0.012 * u;
    const sit = o.sit && !o.walking;
    if (o.selected || o.hover) {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py, u * 0.42, u * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(px, py, u * 0.28, u * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    const base = py - bob - (sit ? 0.18 * u : 0);
    if (!sit) {
      const sw = o.walking ? Math.sin(o.t * 11) * 0.05 * u : 0;
      ctx.fillStyle = '#353b47';
      ctx.fillRect(px - 0.13 * u, base - 0.26 * u - sw, 0.1 * u, 0.26 * u + sw);
      ctx.fillRect(px + 0.03 * u, base - 0.26 * u + sw, 0.1 * u, 0.26 * u - sw);
    }
    const bodyTop = base - 0.62 * u;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.roundRect(px - 0.21 * u, bodyTop, 0.42 * u, 0.4 * u, 0.12 * u); ctx.fill();
    if (o.face === 'front') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.moveTo(px - 0.08 * u, bodyTop + 0.01 * u); ctx.lineTo(px, bodyTop + 0.1 * u); ctx.lineTo(px + 0.08 * u, bodyTop + 0.01 * u); ctx.fill();
      if (p.role === 'ceo') { ctx.fillStyle = '#c0392b'; ctx.fillRect(px - 0.02 * u, bodyTop + 0.06 * u, 0.04 * u, 0.18 * u); }
    }
    const hy = bodyTop - 0.24 * u;
    const dir = o.flip ? -1 : 1;
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(px, hy - 0.03 * u, 0.29 * u, 0, Math.PI * 2); ctx.fill();
    if (o.face === 'front') {
      ctx.fillStyle = '#ffe1c6';
      ctx.beginPath(); ctx.ellipse(px + dir * 0.02 * u, hy + 0.05 * u, 0.24 * u, 0.2 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.hair;
      ctx.beginPath(); ctx.ellipse(px - dir * 0.06 * u, hy - 0.12 * u, 0.22 * u, 0.09 * u, -dir * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2420';
      for (const ex of [-0.09, 0.09]) { ctx.beginPath(); ctx.arc(px + (ex + dir * 0.03) * u, hy + 0.06 * u, 0.032 * u, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,120,120,.35)';
      for (const ex of [-0.15, 0.15]) { ctx.beginPath(); ctx.arc(px + (ex + dir * 0.03) * u, hy + 0.13 * u, 0.04 * u, 0, Math.PI * 2); ctx.fill(); }
    }
    if (p.role === 'pm') {
      ctx.strokeStyle = '#333'; ctx.lineWidth = 0.035 * u;
      ctx.beginPath(); ctx.arc(px, hy - 0.03 * u, 0.31 * u, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    return hy - 0.33 * u;
  }

  label(ctx, text, x, y, o = {}) {
    ctx.font = o.font || `600 ${o.size || 11}px Pretendard, system-ui, sans-serif`;
    const w = ctx.measureText(text).width + (o.dot ? 16 : 10);
    const h = (o.size || 11) + 10;
    ctx.fillStyle = o.bg || 'rgba(255,255,255,.95)';
    ctx.strokeStyle = o.border || 'rgba(0,0,0,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, o.r ?? 5); ctx.fill(); ctx.stroke();
    if (o.dot) { ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(x - w / 2 + 8, y, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = o.color || '#1f2328';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + (o.dot ? 4 : 0), y + 0.5);
  }

  bubble(ctx, text, x, y, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '500 14px Pretendard, system-ui, sans-serif';
    const maxW = 220;
    const lines = [];
    let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20;
    const h = lines.length * 19 + 12;
    const bx = Math.max(4, Math.min(this.cw - w - 4, x - w / 2)), by = y - h - 8;
    ctx.shadowColor = 'rgba(0,0,0,.15)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.moveTo(x - 5, by + h - 1); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h - 1); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.stroke();
    ctx.fillStyle = '#1f2328'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 7 + i * 19));
    ctx.restore();
  }

  // ---------- 메인 그리기 ----------
  draw(now) {
    this.fit();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cw, this.ch);
    const key = `${this.floor}:${this.a}:${this.ox}:${this.oy}:${this.canvas.width}`;
    if (!this.layer || key !== this.layerKey) { this.layer = this.drawFloorLayer(); this.layerKey = key; }
    ctx.drawImage(this.layer, 0, 0, this.cw, this.ch);

    const f = FLOORS[this.floor];
    const here = [...this.sprites.values()].filter((s) => s.floor === this.floor && !s.hiddenUntil && s.agent);
    const standing = new Set(here.filter((s) => !s.walking).map((s) => `${Math.floor(s.x)},${Math.floor(s.y)}`));
    const working = new Set(here.filter((s) => !s.walking && s.agent.status === 'working').map((s) => `${Math.floor(s.x)},${Math.floor(s.y)}`));
    const list = [];
    for (const w of f.walls.values()) list.push({ k: w.x + w.y + 0.5, fn: () => this.drawWall(ctx, w, now) });
    list.push({ k: f.elevator.wallY + 0.55, fn: () => this.drawElevator(ctx, f) });
    for (const it of f.items) {
      const active = it.kind === 'desk' || it.kind === 'console'
        ? (it.mon === 'E' ? working.has(`${it.x + 1},${it.y}`) : working.has(`${it.x},${it.y + 1}`))
        : false;
      list.push({ k: it.x + it.y + (it.walk ? 0.95 : 1), fn: () => this.drawItem(ctx, it, now, active) });
    }
    const heads = [];
    const seatAt = (s) => {
      const it = this.itemAt[this.floor].get(`${Math.floor(s.x)},${Math.floor(s.y)}`);
      return it && (it.kind === 'chair' || it.kind === 'sofa');
    };
    for (const s of here) {
      list.push({
        k: s.x + s.y + 0.02,
        fn: () => {
          const [px, py] = this.iso(s.x, s.y);
          const top = this.drawPerson(ctx, px, py, s.agent, { t: s.t, walking: s.walking, face: s.face, flip: s.flip, sit: seatAt(s), selected: this.selected === s.id, hover: this.hover === s.id });
          heads.push({ s, px, py, top });
        },
      });
    }
    if (f.ceo) {
      list.push({ k: f.ceo.x + f.ceo.y + 1.02, fn: () => {
        const [px, py] = this.iso(f.ceo.x + 0.5, f.ceo.y + 0.5);
        const top = this.drawPerson(ctx, px, py, this.ceo, { t: now / 1000, face: 'front', sit: true });
        heads.push({ ceo: true, px, py, top });
      } });
    }
    list.sort((p, q) => p.k - q.k);
    for (const d of list) d.fn();

    // 방 이름표
    for (const r of this.a < 11 ? [] : f.rooms) {
      const [lx, ly] = this.iso(r.x + r.w / 2, r.y + r.h * 0.42, r.walls ? 1.25 : 0.6);
      const fs = Math.max(12, Math.min(15, this.a * 0.5));
      this.label(ctx, r.label || r.id, lx, ly, { size: fs, font: `700 ${fs}px Pretendard, system-ui, sans-serif` });
    }
    // 이름표, 상태, 말풍선
    this.hits = [];
    for (const h of heads) {
      if (h.ceo) { this.label(ctx, '대표님', h.px, h.py + 14, { size: 12, bg: '#2d3340', color: '#fff', border: '#2d3340' }); continue; }
      const a = h.s.agent;
      this.label(ctx, a.name, h.px, h.py + 14, { size: 12, dot: a.color, font: '700 12px Pretendard, system-ui, sans-serif' });
      this.hits.push({ id: a.id, x: h.px, y: (h.py + h.top) / 2, r: Math.max(14, this.a * 0.55) });
      const sayOn = a.say && now - a.say.at < a.say.ms;
      if (sayOn) {
        const left = a.say.ms - (now - a.say.at);
        this.bubble(ctx, a.say.text, h.px, h.top, Math.min(1, left / 400), a.color);
      } else if (a.activity && (a.status === 'working' || a.status === 'waiting') && !h.s.walking) {
        this.label(ctx, a.activity, h.px, h.top - 12, { size: 12, dot: a.status === 'waiting' ? '#e0566a' : '#22a37f', border: a.color });
      }
    }
  }

  hit(mx, my) {
    let best = null, bd = Infinity;
    for (const h of this.hits || []) {
      const d = Math.hypot(mx - h.x, my - h.y);
      if (d < h.r && d < bd) { best = h.id; bd = d; }
    }
    return best;
  }
}
