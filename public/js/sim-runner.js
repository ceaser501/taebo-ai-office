// 데모용 가짜 러너 — Claude 대신 그럴듯한 도구 호출 이벤트와 결과를 만든다.
// 실제 Claude 러너(server/claude-runner.mjs)와 같은 인터페이스: run(opts) → { text, sessionId, isError }

import { AGENTS } from './engine.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nameOf = (role) => AGENTS.find((a) => a.role === role)?.id;

const SCRIPTS = {
  backend: [
    ['Read', { file_path: 'README.md' }], ['Grep', { pattern: 'router' }], ['Glob', { pattern: 'src/**/*.js' }],
    ['WebSearch', { query: 'node fetch retry 패턴' }], ['Write', { file_path: 'src/api/handler.js' }],
    ['Edit', { file_path: 'src/db/schema.sql' }], ['Bash', { command: 'npm test' }], ['Bash', { command: 'node scripts/seed.js' }],
  ],
  frontend: [
    ['Read', { file_path: 'design/tokens.css' }], ['Glob', { pattern: 'src/components/*' }],
    ['WebSearch', { query: 'css grid 반응형 카드 레이아웃' }], ['Write', { file_path: 'src/components/Card.jsx' }],
    ['Edit', { file_path: 'src/pages/index.html' }], ['Bash', { command: 'npm run build' }], ['Bash', { command: 'npm run lint' }],
  ],
  designer: [
    ['WebSearch', { query: '미니멀 대시보드 레퍼런스' }], ['WebFetch', { url: 'https://dribbble.com/shots' }],
    ['Read', { file_path: 'brand/guide.md' }], ['Write', { file_path: 'design/tokens.css' }],
    ['Write', { file_path: 'design/mockup.svg' }], ['Edit', { file_path: 'design/mockup.html' }],
  ],
};

const MUTTER = {
  backend: ['응답 포맷은 JSON으로 통일하자', '여기 예외 처리가 빠졌네', '인덱스 하나 추가해야겠다'],
  frontend: ['이건 컴포넌트로 빼는 게 낫겠다', '모바일에서 깨지네… 고치자', '로딩 상태도 넣어야지'],
  designer: ['여백을 조금 더 주자', '대비가 약하네, 색 올리자', '아이콘 톤 맞추는 중 🎨'],
};

const QUESTIONS = {
  backend: ['로그인은 소셜 로그인까지 넣을까요, 이메일만 할까요?', '데이터는 얼마나 보관할까요? 30일이면 될까요?'],
  frontend: ['모바일 우선으로 갈까요, 데스크톱 우선으로 갈까요?', '다크 모드도 이번에 같이 넣을까요?'],
  designer: ['메인 컬러는 기존 오렌지 유지할까요?', '시안 A(미니멀)와 B(일러스트) 중 어느 쪽이 좋으세요?'],
};

const PLAN_LINES = {
  backend: ['API 스펙은 오늘 안에 초안 낼게요', '데이터 구조부터 잡고 들어갈게요'],
  frontend: ['디자인 나오는 대로 붙일게요. 레이아웃부터!', '컴포넌트 단위로 쪼개서 갈게요'],
  designer: ['레퍼런스 찾아보고 시안 2개 드릴게요', '컬러랑 타이포 토큰 먼저 정리할게요'],
};

function inferRoles(text) {
  const roles = new Set();
  if (/디자인|UI|화면|로고|배너|색|레이아웃|랜딩|리디자인|시안/.test(text)) roles.add('designer').add('frontend');
  if (/API|서버|DB|데이터|백엔드|로그인|결제|크롤|스크립트|자동화|봇|CSV|알림/i.test(text)) roles.add('backend');
  if (/프론트|화면|페이지|웹|앱|컴포넌트/.test(text)) roles.add('frontend');
  if (!roles.size) roles.add('backend').add('frontend');
  return [...roles];
}

const SUB_TITLE = {
  backend: (c) => `${c} — 데이터·API`,
  frontend: (c) => `${c} — 화면 구현`,
  designer: (c) => `${c} — 시안·디자인 토큰`,
};

export function createSimRunner({ speed = 1 } = {}) {
  const wait = (a, b) => sleep(rand(a, b) / speed);
  let n = 0;

  async function steps(onEvent, list, count) {
    const seq = [...list].sort(() => Math.random() - 0.5).slice(0, count);
    for (const [name, input] of seq) {
      onEvent({ type: 'tool', name, input });
      await wait(2600, 5200);
    }
  }

  return {
    name: 'sim',
    async run({ kind, agent, prompt, onEvent = () => {}, meta = {} }) {
      const sessionId = `sim-${++n}`;

      if (kind === 'plan') {
        const title = /제목: (.+)/.exec(prompt)?.[1] || '새 일감';
        const core = title.length > 16 ? title.slice(0, 15) + '…' : title;
        onEvent({ type: 'tool', name: 'Read', input: { file_path: 'brief.md' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'TodoWrite', input: {} });
        await wait(2500, 4000);
        const roles = inferRoles(prompt);
        const subtasks = roles.map((role) => ({ role, title: SUB_TITLE[role](core), detail: `${title} 중 ${role} 파트` }));
        const meeting = [
          { speaker: 'maro', line: `"${core}" 킥오프 할게요. ${roles.length}개로 나눴어요.` },
          ...roles.map((r) => ({ speaker: nameOf(r), line: pick(PLAN_LINES[r]) })),
          { speaker: 'geom', line: '끝나면 검수실로 보내주세요 🔍' },
          { speaker: 'maro', line: '좋아요! 대표님 확인 필요한 건 3층으로 🙌' },
        ];
        return { sessionId, text: JSON.stringify({ summary: `${title} — ${roles.length}개 파트`, subtasks, meeting }) };
      }

      if (kind === 'work') {
        const role = agent.role;
        if (meta.resumed) {
          await steps(onEvent, SCRIPTS[role], 2);
          return { sessionId, text: `대표님 답변 반영해서 마무리했습니다. (${meta.title})` };
        }
        const total = 3 + Math.floor(Math.random() * 3);
        const half = Math.ceil(total / 2);
        await steps(onEvent, SCRIPTS[role], half);
        if (Math.random() < 0.5) onEvent({ type: 'text', text: pick(MUTTER[role]) });
        if (meta.allowQuestion && Math.random() < 0.22) {
          return { sessionId, text: `여기까지 진행했어요.\n[질문] ${pick(QUESTIONS[role])}` };
        }
        await steps(onEvent, SCRIPTS[role], total - half);
        if (role !== 'designer') {
          onEvent({ type: 'tool', name: 'Bash', input: { command: 'git commit -m "작업 반영"' } });
          await wait(2500, 4000);
        }
        return { sessionId, text: `완료: ${meta.title}\n파일 ${total - 1}개 작성·수정, 확인까지 마쳤습니다.` };
      }

      if (kind === 'review') {
        onEvent({ type: 'tool', name: 'Glob', input: { pattern: '**/*' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'Read', input: { file_path: 'src/index.html' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'Bash', input: { command: 'npm test' } });
        await wait(3000, 5000);
        const fix = (meta.round || 0) === 0 && Math.random() < 0.3;
        const role = pick(meta.roles?.length ? meta.roles : ['frontend']);
        return {
          sessionId,
          text: JSON.stringify(fix
            ? { verdict: 'fix', summary: '빈 상태 처리가 빠졌어요.', issues: [{ role, title: '빈 상태·에러 처리 보완', detail: '데이터가 없을 때 화면/응답 처리' }] }
            : { verdict: 'pass', summary: '요청 범위 충족, 테스트 통과.' }),
        };
      }

      if (kind === 'wiki') {
        onEvent({ type: 'tool', name: 'Read', input: { file_path: `${meta.id}/README.md` } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'Write', input: { file_path: `wiki/${meta.id}.md` } });
        await wait(2500, 4000);
        return { sessionId, text: `${meta.title} 정리 완료.\n결정사항·결과물·남은 과제를 wiki/${meta.id}.md 에 남겼어요.` };
      }

      return { sessionId, text: '', isError: true };
    },
  };
}
