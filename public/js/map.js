// 층별 평면도 — 방, 벽, 문, 가구, 앉을 자리(spot)를 격자 좌표로 정의하고 길찾기를 제공한다.
// 좌표계: x는 화면 오른쪽 아래, y는 왼쪽 아래로 늘어나는 아이소메트릭 격자.

function makeFloor(id, name, w, h) {
  return { id, name, w, h, rooms: [], items: [], walls: new Map(), blocked: new Set(), spots: {}, seats: {}, elevator: null, windows: null };
}

const hKey = (x, y) => `h:${x},${y}`; // y 위치의 가로 변 (x ~ x+1)
const vKey = (x, y) => `v:${x},${y}`; // x 위치의 세로 변 (y ~ y+1)

function wall(f, key, style) {
  if (f.walls.has(key)) return;
  const [kind, rest] = key.split(':');
  const [x, y] = rest.split(',').map(Number);
  f.walls.set(key, { key, kind, x, y, style });
}

function room(f, r) {
  f.rooms.push(r);
  if (!r.walls) return;
  const doors = new Set((r.doors || []).map(([x, y, s]) => (s === 'N' ? hKey(x, y) : s === 'S' ? hKey(x, y + 1) : s === 'W' ? vKey(x, y) : vKey(x + 1, y))));
  const add = (k) => { if (!doors.has(k)) wall(f, k, r.walls); };
  for (let i = r.x; i < r.x + r.w; i++) { add(hKey(i, r.y)); add(hKey(i, r.y + r.h)); }
  for (let j = r.y; j < r.y + r.h; j++) { add(vKey(r.x, j)); add(vKey(r.x + r.w, j)); }
}

function makeShell(id, name, w, h, windows) {
  const f = makeFloor(id, name, w, h);
  for (let x = 0; x < w; x++) wall(f, hKey(x, 0), 'outer');
  for (let y = 0; y < h; y++) wall(f, vKey(0, y), 'outer');
  if (windows) for (let x = windows[0]; x <= windows[1]; x++) f.walls.get(hKey(x, 0)).window = true;
  return f;
}

function item(f, x, y, kind, opts = {}) {
  f.items.push({ x, y, kind, ...opts });
  if (!opts.walk) f.blocked.add(`${x},${y}`);
}

function spots(f, roomId, list) {
  (f.spots[roomId] ||= []).push(...list.map(([x, y, face = 'front']) => ({ x, y, face })));
}

const row = (x0, x1, fn) => { for (let x = x0; x <= x1; x++) fn(x); };

// ---------------- 1F 사무실 ----------------
function floor1() {
  const f = makeShell(1, '사무실', 26, 22);
  room(f, { id: '자료실', x: 0, y: 0, w: 6, h: 5, color: '#ecdcc2', walls: 'inner', doors: [[3, 4, 'S']] });
  room(f, { id: '개발실', x: 6, y: 0, w: 8, h: 5, color: '#e4e8ef', walls: 'inner', doors: [[10, 4, 'S']] });
  room(f, { id: '서버실', x: 14, y: 0, w: 6, h: 5, color: '#d6dbe2', walls: 'inner', doors: [[16, 4, 'S']], tile: true });
  room(f, { id: '휴게실', x: 20, y: 0, w: 6, h: 12, color: '#f0e2cd', walls: 'inner', doors: [[20, 5, 'W'], [20, 6, 'W'], [22, 11, 'S']] });
  room(f, { id: '정보검색실', x: 0, y: 7, w: 6, h: 5, color: '#e5eadc', walls: 'inner', doors: [[1, 7, 'N'], [3, 11, 'S']] });
  room(f, { id: '회의실', x: 6, y: 7, w: 8, h: 5, color: '#efe7da', walls: 'glass', doors: [[13, 7, 'N'], [7, 11, 'S']] });
  room(f, { id: '검수실', x: 14, y: 7, w: 6, h: 5, color: '#ebe3ec', walls: 'inner', doors: [[17, 7, 'N'], [16, 11, 'S']] });
  room(f, { id: '로비', x: 0, y: 14, w: 5, h: 8, color: '#f6f1ea', label: '안내데스크', marble: true });
  room(f, { id: '업무석', x: 5, y: 14, w: 21, h: 8, color: '#ebe6dd' });
  f.corridor = '#f4efe7';

  // 자료실: 책장, 열람 테이블
  row(0, 5, (x) => item(f, x, 0, 'shelf', { face: 'S' }));
  row(1, 3, (y) => item(f, 0, y, 'shelf', { face: 'E' }));
  item(f, 2, 2, 'table', { color: '#c79b6d' }); item(f, 3, 2, 'table', { color: '#c79b6d' });
  item(f, 5, 3, 'plant');
  spots(f, '자료실', [[2, 3, 'back'], [3, 3, 'back'], [1, 2], [4, 2], [2, 1, 'back'], [4, 1]]);

  // 개발실: 듀얼 모니터 책상 두 줄
  for (const y of [0, 2]) for (const x of [7, 8, 9, 11, 12]) { item(f, x, y, 'desk', { mon: 'S', dual: true }); item(f, x, y + 1, 'chair', { walk: true }); }
  item(f, 13, 0, 'plant');
  spots(f, '개발실', [[7, 1, 'back'], [8, 1, 'back'], [9, 1, 'back'], [11, 1, 'back'], [12, 1, 'back'], [7, 3, 'back'], [8, 3, 'back'], [9, 3, 'back'], [11, 3, 'back'], [12, 3, 'back']]);

  // 서버실: 랙 두 줄
  row(14, 18, (x) => item(f, x, 0, 'rack'));
  row(15, 18, (x) => item(f, x, 2, 'rack'));
  item(f, 19, 0, 'console', { mon: 'S' });
  spots(f, '서버실', [[19, 1, 'back'], [15, 1, 'back'], [17, 1, 'back'], [16, 3, 'back'], [18, 3, 'back'], [14, 3]]);

  // 휴게실: 소파, 커피, 자판기, 창고 박스
  item(f, 20, 0, 'plant'); item(f, 21, 0, 'counter', { coffee: true }); item(f, 22, 0, 'counter');
  item(f, 24, 0, 'vending'); item(f, 25, 0, 'vending', { color: '#2f7fd0' });
  row(21, 23, (x) => item(f, x, 2, 'sofa', { back: 'N', walk: true, color: '#7a8a9c' }));
  item(f, 22, 3, 'table', { low: true, color: '#d9c3a3' }); item(f, 23, 3, 'table', { low: true, color: '#d9c3a3' });
  row(21, 23, (x) => item(f, x, 4, 'sofa', { back: 'S', walk: true, color: '#7a8a9c' }));
  item(f, 24, 8, 'boxes'); item(f, 25, 8, 'boxes', { tall: true }); item(f, 25, 9, 'boxes'); item(f, 24, 10, 'boxes', { tall: true }); item(f, 25, 10, 'boxes');
  item(f, 25, 4, 'plant'); item(f, 21, 10, 'plant');
  spots(f, '휴게실', [[21, 2], [22, 2], [23, 2], [21, 4, 'back'], [22, 4, 'back'], [23, 4, 'back'], [22, 7], [23, 7, 'back'], [21, 8], [22, 9, 'back']]);

  // 정보검색실: 벽면 PC, 지구본, 대형 스크린
  row(8, 10, (y) => { item(f, 0, y, 'desk', { mon: 'E' }); item(f, 1, y, 'chair', { walk: true }); });
  item(f, 4, 8, 'globe');
  row(2, 4, (x) => item(f, x, 7, 'screen'));
  item(f, 5, 11, 'plant');
  spots(f, '정보검색실', [[1, 8, 'back'], [1, 9, 'back'], [1, 10, 'back'], [3, 9], [4, 10]]);

  // 회의실: 화이트보드, 긴 테이블, 12석
  row(8, 11, (x) => item(f, x, 7, 'board'));
  for (const y of [9, 10]) row(8, 11, (x) => item(f, x, y, 'table', { color: '#f3efe8', full: true }));
  row(8, 11, (x) => { item(f, x, 8, 'chair', { walk: true, back: 'N' }); item(f, x, 11, 'chair', { walk: true }); });
  item(f, 6, 7, 'plant'); item(f, 13, 11, 'plant');
  spots(f, '회의실', [[8, 8], [9, 8], [10, 8], [11, 8], [8, 11, 'back'], [9, 11, 'back'], [10, 11, 'back'], [11, 11, 'back'], [7, 9], [7, 10], [12, 9], [12, 10]]);

  // 검수실: 책상 + 돋보기·저울
  item(f, 15, 8, 'desk', { mon: 'S' }); item(f, 16, 8, 'desk', { mon: 'S', prop: 'magnifier' }); item(f, 18, 8, 'desk', { prop: 'scale' });
  for (const x of [15, 16, 18]) item(f, x, 9, 'chair', { walk: true });
  item(f, 19, 11, 'plant'); item(f, 14, 11, 'shelf', { face: 'S', short: true });
  spots(f, '검수실', [[15, 9, 'back'], [16, 9, 'back'], [18, 9, 'back'], [17, 10]]);

  // 로비: 엘리베이터, 안내데스크, 대기 의자
  f.elevator = { x: 0, y: 16, wallY: 15 };
  row(1, 3, (x) => item(f, x, 18, 'counter', { front: true }));
  item(f, 4, 14, 'plant'); item(f, 0, 21, 'plant');
  item(f, 1, 21, 'sofa', { back: 'S', walk: true, color: '#c9a77c' }); item(f, 3, 21, 'sofa', { back: 'S', walk: true, color: '#c9a77c' });
  item(f, 2, 21, 'table', { low: true, round: true, color: '#e9e2d8' });
  spots(f, '로비', [[2, 17], [1, 21, 'back'], [3, 21, 'back'], [3, 16], [4, 19]]);

  // 업무석: 4개 클러스터 × 6석
  const desks = [];
  for (const cx of [7, 12, 17, 22]) for (const y of [15, 18]) row(cx, cx + 2, (x) => {
    item(f, x, y, 'desk', { mon: 'S', divider: true }); item(f, x, y + 1, 'chair', { walk: true }); desks.push([x, y + 1, 'back']);
  });
  item(f, 5, 14, 'plant'); item(f, 25, 14, 'plant'); item(f, 11, 21, 'plant'); item(f, 21, 21, 'plant');
  spots(f, '업무석', desks);
  f.seats = { maro: [2, 17], hangyeol: [8, 16], daon: [13, 16], bora: [18, 16], geom: [23, 16] };
  return f;
}

// ---------------- 2F 위키·기록 ----------------
function floor2() {
  const f = makeShell(2, '위키·기록', 16, 12);
  room(f, { id: '위키 서고', x: 0, y: 0, w: 9, h: 7, color: '#ecdcc2', walls: 'inner', doors: [[4, 6, 'S']] });
  room(f, { id: '집필실', x: 9, y: 0, w: 7, h: 7, color: '#e9e5ee', walls: 'inner', doors: [[12, 6, 'S']] });
  room(f, { id: '엘리베이터 홀', x: 0, y: 9, w: 5, h: 3, color: '#f6f1ea', marble: true, label: '2F 홀' });
  room(f, { id: '라운지', x: 5, y: 9, w: 11, h: 3, color: '#f0e2cd' });
  f.corridor = '#f4efe7';

  row(0, 8, (x) => item(f, x, 0, 'shelf', { face: 'S' }));
  row(1, 5, (y) => item(f, 0, y, 'shelf', { face: 'E' }));
  row(3, 6, (x) => item(f, x, 3, 'shelf', { face: 'S' }));
  item(f, 8, 5, 'plant');
  spots(f, '위키 서고', [[2, 2, 'back'], [7, 2, 'back'], [2, 5], [5, 4, 'back'], [7, 4]]);

  for (const y of [1, 4]) for (const x of [10, 11, 13, 14]) { item(f, x, y, 'desk', { mon: 'S' }); item(f, x, y + 1, 'chair', { walk: true }); }
  item(f, 15, 0, 'plant');
  spots(f, '집필실', [[11, 2, 'back'], [10, 2, 'back'], [13, 2, 'back'], [14, 2, 'back'], [10, 5, 'back'], [13, 5, 'back']]);

  f.elevator = { x: 0, y: 10, wallY: 9 };
  item(f, 4, 11, 'plant');
  row(7, 9, (x) => item(f, x, 10, 'sofa', { back: 'S', walk: true, color: '#8c9a7a' }));
  row(12, 14, (x) => item(f, x, 10, 'sofa', { back: 'S', walk: true, color: '#8c9a7a' }));
  item(f, 15, 9, 'plant'); item(f, 11, 11, 'plant');
  spots(f, '라운지', [[7, 10, 'back'], [8, 10, 'back'], [9, 10, 'back'], [12, 10, 'back'], [13, 10, 'back'], [14, 10, 'back']]);
  spots(f, '엘리베이터 홀', [[2, 10], [3, 11]]);
  f.seats = { sonul: [11, 2] };
  return f;
}

// ---------------- 3F 대표실 ----------------
function floor3() {
  const f = makeShell(3, '대표실', 16, 12, [3, 15]);
  room(f, { id: '대표실', x: 3, y: 0, w: 13, h: 8, color: '#efe6d8', walls: 'glass', doors: [[9, 7, 'S']] });
  room(f, { id: '대표실 입구', x: 3, y: 8, w: 13, h: 4, color: '#f6f1ea', marble: true });
  room(f, { id: '엘리베이터 홀', x: 0, y: 0, w: 3, h: 12, color: '#f3eee6', label: '3F 홀' });
  f.corridor = '#f4efe7';

  row(4, 6, (x) => item(f, x, 0, 'shelf', { face: 'S' }));
  item(f, 3, 1, 'shelf', { face: 'E' }); item(f, 3, 2, 'shelf', { face: 'E' });
  row(9, 11, (x) => item(f, x, 2, 'ceodesk', { mon: x === 10 }));
  item(f, 10, 1, 'chair', { walk: true, big: true });
  row(5, 7, (x) => item(f, x, 5, 'sofa', { back: 'N', walk: true, color: '#3b3f46' }));
  item(f, 6, 6, 'table', { low: true, color: '#e8e2d6' });
  row(12, 14, (x) => item(f, x, 5, 'sofa', { back: 'N', walk: true, color: '#3b3f46' }));
  item(f, 13, 6, 'table', { low: true, color: '#e8e2d6' });
  item(f, 15, 0, 'plant'); item(f, 3, 7, 'plant'); item(f, 15, 7, 'plant'); item(f, 8, 0, 'plant');
  spots(f, '대표실', [[10, 3, 'back'], [9, 3, 'back'], [11, 3, 'back'], [5, 5], [6, 5], [12, 5], [13, 5]]);

  row(6, 12, (x) => item(f, x, 10, 'sofa', { back: 'S', walk: true, color: '#c9a77c' }));
  item(f, 4, 11, 'plant'); item(f, 14, 11, 'plant');
  spots(f, '대표실 입구', [[6, 10, 'back'], [7, 10, 'back'], [8, 10, 'back'], [10, 10, 'back'], [11, 10, 'back'], [12, 10, 'back'], [9, 9]]);

  f.elevator = { x: 0, y: 9, wallY: 8 };
  item(f, 2, 0, 'plant'); item(f, 2, 5, 'plant');
  spots(f, '엘리베이터 홀', [[1, 10], [1, 4]]);
  f.ceo = { x: 10, y: 1 };
  return f;
}

export const FLOORS = { 1: floor1(), 2: floor2(), 3: floor3() };

export function roomAt(f, x, y) {
  return f.rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

export function walkable(f, x, y) {
  return x >= 0 && y >= 0 && x < f.w && y < f.h && !f.blocked.has(`${x},${y}`);
}

function crosses(f, x, y, nx, ny) {
  if (nx === x) return f.walls.has(hKey(x, Math.max(y, ny)));
  return f.walls.has(vKey(Math.max(x, nx), y));
}

// 4방향 A* 길찾기 — 벽(변)과 가구(칸)를 피한다
export function findPath(f, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [];
  const key = (x, y) => y * f.w + x;
  const open = [[sx, sy]];
  const g = new Map([[key(sx, sy), 0]]);
  const from = new Map();
  const fs = new Map([[key(sx, sy), Math.abs(tx - sx) + Math.abs(ty - sy)]]);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fs.get(key(...open[i])) < fs.get(key(...open[bi]))) bi = i;
    const [x, y] = open.splice(bi, 1)[0];
    const k = key(x, y);
    if (x === tx && y === ty) {
      const path = [];
      let c = k;
      while (c !== key(sx, sy)) { path.unshift([c % f.w, Math.floor(c / f.w)]); c = from.get(c); }
      return path;
    }
    closed.add(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (!(nx === tx && ny === ty) && !walkable(f, nx, ny)) continue;
      if (nx < 0 || ny < 0 || nx >= f.w || ny >= f.h || crosses(f, x, y, nx, ny)) continue;
      const ng = g.get(k) + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        from.set(nk, k);
        g.set(nk, ng);
        fs.set(nk, ng + Math.abs(tx - nx) + Math.abs(ty - ny));
        if (!open.some(([ox, oy]) => ox === nx && oy === ny)) open.push([nx, ny]);
      }
    }
  }
  return null;
}
