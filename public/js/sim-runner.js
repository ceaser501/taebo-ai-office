// 데모용 가짜 러너 — Claude 대신 그럴듯한 도구 호출 이벤트와 결과를 만든다.
// 실제 Claude 러너(server/claude-runner.mjs)와 같은 인터페이스: run(opts) → { text, sessionId, isError }

import { AGENTS } from './engine.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nameOf = (role) => AGENTS.find((a) => a.role === role)?.id;
const WRITES = ['Write', 'Edit'];

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
  researcher: [
    ['WebSearch', { query: '생성형 AI 업무 활용 사례 2026' }], ['WebFetch', { url: 'https://www.mckinsey.com/ai-report' }],
    ['WebSearch', { query: '기업 AI 도입 통계' }], ['WebFetch', { url: 'https://hbr.org/ai-at-work' }],
    ['Read', { file_path: 'notes/outline.md' }], ['WebSearch', { query: 'AI 활용 교육 커리큘럼 예시' }],
  ],
  docs: [
    ['Read', { file_path: 'research.md' }], ['Glob', { pattern: '*.md' }], ['Write', { file_path: 'outline.md' }],
    ['Write', { file_path: 'make_ppt.py' }], ['Bash', { command: 'python3 make_ppt.py' }],
  ],
};

// 마지막에 반드시 남기는 결과물
const FINAL = { researcher: () => 'research.md', designer: () => 'design/mockup.html' };

const MUTTER = {
  backend: ['응답 포맷은 JSON으로 통일하자', '여기 예외 처리가 빠졌네', '인덱스 하나 추가해야겠다'],
  frontend: ['이건 컴포넌트로 빼는 게 낫겠다', '모바일에서 깨지네… 고치자', '로딩 상태도 넣어야지'],
  designer: ['여백을 조금 더 주자', '대비가 약하네, 색 올리자', '아이콘 톤 맞추는 중 🎨'],
  researcher: ['출처가 2023년이네, 최신 걸로 찾자', '사례 3개면 충분하겠다', '통계는 원문 확인 필수 🔎'],
  docs: ['한 장에 메시지 하나만!', '표지는 심플하게 가자', '리서치 내용 잘 정리돼 있네 👍'],
};

const QUESTIONS = {
  backend: ['로그인은 소셜 로그인까지 넣을까요, 이메일만 할까요?', '데이터는 얼마나 보관할까요? 30일이면 될까요?'],
  frontend: ['모바일 우선으로 갈까요, 데스크톱 우선으로 갈까요?', '다크 모드도 이번에 같이 넣을까요?'],
  designer: ['메인 컬러는 기존 오렌지 유지할까요?', '시안 A(미니멀)와 B(일러스트) 중 어느 쪽이 좋으세요?'],
  researcher: ['국내 사례 위주로 할까요, 해외 사례도 넣을까요?', '수강생 수준은 입문자 기준이면 될까요?'],
  docs: ['슬라이드는 15장 안쪽이면 될까요?', '회사 로고를 표지에 넣을까요?'],
};

const PLAN_LINES = {
  backend: ['API 스펙은 오늘 안에 초안 낼게요', '데이터 구조부터 잡고 들어갈게요'],
  frontend: ['디자인 나오는 대로 붙일게요. 레이아웃부터!', '컴포넌트 단위로 쪼개서 갈게요'],
  designer: ['레퍼런스 찾아보고 시안 2개 드릴게요', '컬러랑 타이포 토큰 먼저 정리할게요'],
  researcher: ['사례랑 통계부터 모아서 research.md로 넘길게요', '출처 붙여서 목차까지 잡아 드릴게요'],
  docs: ['리서치 받는 대로 슬라이드로 옮길게요', '목차 먼저 잡고, 파일명은 요청대로 맞출게요'],
};

const SUB_TITLE = {
  backend: (c) => `${c} — 데이터·API`,
  frontend: (c) => `${c} — 화면 구현`,
  designer: (c) => `${c} — 시안·디자인 토큰`,
  researcher: (c) => `${c} — 자료 조사`,
  docs: (c) => `${c} — 문서·PPT 제작`,
};

// 실행 순서: 앞 역할이 끝나야 뒤 역할이 시작
const AFTER = { docs: ['researcher'], frontend: ['designer'] };

function inferRoles(text) {
  const roles = [];
  const add = (r) => { if (!roles.includes(r)) roles.push(r); };
  if (/리서치|조사|자료|사례|통계|트렌드/.test(text)) add('researcher');
  if (/PPT|피피티|강의|발표|슬라이드|보고서|문서|\.pptx|\.docx/i.test(text)) add('docs');
  if (/디자인|UI|로고|배너|레이아웃|랜딩|리디자인|시안/.test(text)) { add('designer'); add('frontend'); }
  if (/API|서버|DB|데이터|백엔드|로그인|결제|크롤|스크립트|자동화|봇|CSV|알림/i.test(text)) add('backend');
  if (/프론트|화면|페이지|웹|앱|컴포넌트/.test(text)) add('frontend');
  if (!roles.length) { add('backend'); add('frontend'); }
  return roles;
}

const fileIn = (text) => /([\w가-힣.\-]+\.(?:pptx|docx|xlsx|pdf|md|html))/i.exec(text || '')?.[1];

export function createSimRunner({ speed = 1 } = {}) {
  const wait = (a, b) => sleep(rand(a, b) / speed);
  let n = 0;

  async function steps(onEvent, workdir, list, count) {
    const seq = [...list].sort(() => Math.random() - 0.5).slice(0, count);
    for (const [name, input] of seq) {
      onEvent({ type: 'tool', name, input, file: WRITES.includes(name) ? `${workdir}/${input.file_path}` : undefined });
      await wait(2600, 5200);
    }
  }

  return {
    name: 'sim',
    async run({ kind, agent, prompt, workdir = '', onEvent = () => {}, meta = {} }) {
      const sessionId = `sim-${++n}`;

      if (kind === 'plan') {
        const title = /제목: (.+)/.exec(prompt)?.[1] || '새 일감';
        const request = /제목: [\s\S]*?\n\n/.exec(prompt)?.[0] || title;
        const core = title.length > 16 ? title.slice(0, 15) + '…' : title;
        onEvent({ type: 'tool', name: 'Read', input: { file_path: 'brief.md' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'TodoWrite', input: {} });
        await wait(2500, 4000);
        let roles = inferRoles(request);
        if (meta.headcount) roles = roles.slice(0, meta.headcount);
        const file = fileIn(request);
        const subtasks = roles.map((role) => ({
          key: role, role, title: SUB_TITLE[role](core),
          detail: `${title} 중 ${role} 파트${role === 'docs' && file ? `. 파일명은 ${file}` : ''}`,
          after: (AFTER[role] || []).filter((r) => roles.includes(r)),
        }));
        const meeting = [
          { speaker: 'maro', line: `"${core}" 킥오프 할게요. ${roles.length}명이서 나눠 갑니다.` },
          ...roles.map((r) => ({ speaker: nameOf(r), line: pick(PLAN_LINES[r]) })),
          { speaker: 'geom', line: '끝나면 검수실로 보내주세요 🔍' },
          { speaker: 'maro', line: '마지막엔 대표님 컨펌 받는 것까지! 🙌' },
        ];
        return { sessionId, text: JSON.stringify({ summary: `${title} — ${roles.length}개 파트`, subtasks, meeting }) };
      }

      if (kind === 'work') {
        const role = agent.role;
        const final = role === 'docs' ? fileIn(meta.request) || '강의자료.pptx' : FINAL[role]?.();
        const finish = async () => {
          if (final) { onEvent({ type: 'tool', name: 'Write', input: { file_path: final }, file: `${workdir}/${final}` }); await wait(2500, 4000); }
          if (role === 'backend' || role === 'frontend') { onEvent({ type: 'tool', name: 'Bash', input: { command: 'git commit -m "작업 반영"' } }); await wait(2500, 4000); }
        };
        if (meta.resumed || meta.fix) {
          await steps(onEvent, workdir, SCRIPTS[role], 2);
          await finish();
          return { sessionId, text: `${meta.fix ? '수정 요청 반영' : '대표님 답변 반영'}해서 마무리했습니다.${final ? ` (${final})` : ''}` };
        }
        const total = 3 + Math.floor(Math.random() * 3);
        const half = Math.ceil(total / 2);
        await steps(onEvent, workdir, SCRIPTS[role], half);
        if (Math.random() < 0.5) onEvent({ type: 'text', text: pick(MUTTER[role]) });
        if (meta.allowQuestion && Math.random() < 0.22) {
          return { sessionId, text: `여기까지 진행했어요.\n[질문] ${pick(QUESTIONS[role])}` };
        }
        await steps(onEvent, workdir, SCRIPTS[role], total - half);
        await finish();
        return { sessionId, text: `완료: ${meta.title}${final ? ` → ${final}` : ''}. 확인까지 마쳤습니다.` };
      }

      if (kind === 'review') {
        onEvent({ type: 'tool', name: 'Glob', input: { pattern: '**/*' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'Read', input: { file_path: 'outline.md' } });
        await wait(2500, 4000);
        onEvent({ type: 'tool', name: 'Bash', input: { command: 'npm test' } });
        await wait(3000, 5000);
        const fix = (meta.round || 0) === 0 && Math.random() < 0.3;
        const role = pick(meta.roles?.length ? meta.roles : ['frontend']);
        return {
          sessionId,
          text: JSON.stringify(fix
            ? { verdict: 'fix', summary: '빠진 부분이 있어요.', issues: [{ role, title: '누락 내용 보완', detail: '요청 항목 중 빠진 부분 보완' }] }
            : { verdict: 'pass', summary: '요청 범위 충족, 파일명·형식 확인 완료.' }),
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
