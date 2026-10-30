# 태보 AI 사무실

> 이 레포에는 사무실이 두 개 있습니다.
>
> | 사무실 | 하는 일 | 주소 |
> |---|---|---|
> | **태보 AI 사무실** (이 문서) | 일감을 주면 AI 팀이 나눠서 일하고 컨펌을 받으러 옴 | https://ceaser501.github.io/taebo-ai-office/ |
> | **👥 사람 사무실** ([frog/](frog/)) | 내 Claude Code 세션(클라우드 세션 포함)을 직원으로 지켜보는 화면. 보기 전용, MIT 원본(claude-3d-frog-office) 사본에 사람 캐릭터 추가 | https://ceaser501.github.io/taebo-ai-office/frog/ (데모) |
>
> **밖에서 실제로 쓰기**: Hugging Face Spaces와 Supabase(무료)에 올리는 방법은 [deploy/README.md](deploy/README.md)에 있습니다. 서버 하나에 두 사무실이 같이 뜨고, 클라우드 세션도 사람 사무실에 나옵니다.

Claude 에이전트 팀이 일하는 모습을 아이소메트릭 사무실로 보여 주는 관제 대시보드입니다.
일감을 시키면 PM이 필요한 사람과 순서를 정해 회의를 열고, 팀원들이 실제 Claude Code로 작업한 뒤 대표님께 컨펌을 받으러 옵니다.
캐릭터는 쓰는 도구에 따라 방을 옮겨 다닙니다.

> **Pages 화면은 기본적으로 데모입니다.** 내 PC에서 `npm run start:claude`를 띄워 두고 Pages 화면에서 **[내 PC 연결]**을 누르면 실제로 일을 시킬 수 있습니다.
> 이건 같은 PC에서만 됩니다. 폰이나 밖에서 쓰는 방법은 [ROADMAP.md](ROADMAP.md)에 있습니다.

## 실행

```bash
npm start                # 시뮬레이션 모드 (Claude 호출 없음, 비용 0)
npm run start:claude     # 실제 Claude Code로 일함 (토큰 비용 발생)
```

브라우저에서 http://localhost:4300 을 열면 됩니다. Node 20 이상이 필요하고, 설치할 패키지는 없습니다.

`public/index.html`만 정적으로 열어도 동작합니다. 이 경우 서버가 없으면 브라우저 안에서 데모 엔진이 돌아갑니다.

**GitHub Pages**: 저장소 Settings → Pages → Source를 "Deploy from a branch", Branch를 `main` / `/ (root)`로 두면
https://ceaser501.github.io/taebo-ai-office/ 에서 열립니다.

### Pages 화면으로 내 PC에 일 시키기

1. 내 PC 터미널에서 `npm run start:claude`를 실행합니다.
2. 같은 PC의 크롬에서 Pages 주소를 열고, 상단의 **[내 PC 연결]**을 누릅니다.
   - 크롬이 "로컬 네트워크 접근"을 물어보면 허용합니다.
3. 칩이 `실시간 · Claude (내 PC)`로 바뀌면 연결된 것입니다. 이제부터 시키는 일은 내 PC의 Claude가 합니다.

- 한 번 연결해 두면 다음부터는 자동으로 붙습니다. 로컬 서버가 꺼져 있으면 데모로 돌다가, 켜지는 순간 자동으로 실제 모드로 바뀝니다.
- **[연결 해제]**를 누르면 다시 데모로 돌아갑니다.
- 로컬 서버는 `ALLOW_ORIGINS`(기본 `https://ceaser501.github.io`)에 있는 주소의 화면 요청만 받습니다. 다른 사이트가 내 PC 서버에 일을 시키지 못하게 막는 설정입니다.
- 포트를 바꿨다면 Pages 주소 뒤에 `?server=http://localhost:5000`처럼 붙여서 한 번 열면 기억합니다.
- 크롬과 엣지는 됩니다. 사파리는 https 사이트에서 http localhost 연결을 막아서 안 될 수 있습니다.

실제 모드를 쓰려면 `claude` CLI가 설치되어 있고 로그인(또는 `ANTHROPIC_API_KEY`)이 되어 있어야 합니다.
PPT를 만들게 하려면 `pip install python-pptx`도 해 두세요. 없으면 도담이 3층에 와서 설치해 달라고 질문합니다.

처음 시험할 때는 저렴한 모델로 돌려 보세요.

```bash
CLAUDE_MODEL=haiku npm run start:claude
```

## 팀원

| 이름 | 역할 | 하는 일 |
|---|---|---|
| 마로 | PM·관제 | 일감 분석, 사람·순서 정하기, 킥오프 회의 |
| 하람 | 리서처 | 웹 조사 → 출처 포함 `research.md` |
| 도담 | 문서·PPT | 보고서, 강의자료, `.pptx` 제작 (python-pptx) |
| 보라 | 디자이너 | 시안, 디자인 토큰 |
| 다온 | 프론트엔드 | 화면, 웹 페이지 |
| 한결 | 백엔드 | API, 데이터, 스크립트 |
| 검이 | QA | 검수 (자동 참여) |
| 손글씨 | 위키 기록 | 끝난 일 문서화 (자동 참여) |

마로는 일감마다 필요한 사람만 고릅니다. 강의자료 일감이면 하람과 도담만 들어가고, 개발자는 빠집니다.

## 일이 흘러가는 순서

예: "AI 활용 사례를 리서치해서 강의자료 만들어줘. 파일명은 AI활용강의.pptx. 2명이서 협업해."

1. **접수**: 대표님(사용자)이 일감을 등록합니다. "2명이서", "혼자" 같은 인원 표현을 읽어서 그 인원 안에서만 나눕니다.
2. **기획**: 마로가 Claude로 필요한 사람과 순서를 정합니다. 예시에서는 하람(리서치)이 먼저 하고, 도담(PPT)이 그 뒤에 합니다. 회의 대사도 이때 Claude가 씁니다.
3. **킥오프 회의**: 담당자들이 회의실로 걸어가 모이고, 대사를 말풍선으로 주고받습니다.
4. **실무**: 담당자가 각자 `claude -p`로 작업합니다. 같은 일감은 `workspace/<일감ID>/` 폴더를 함께 씁니다.
   - 선행 작업이 있는 일감은 앞사람이 끝날 때까지 기다립니다. 끝나면 회의실에서 **인수인계 회의**를 하고 시작합니다.
   - 대표님 결정이 필요하면 3층 대표실 입구로 올라가서 기다립니다. "대표님 기다림"에서 답하면 같은 세션(`--resume`)으로 이어서 작업합니다.
5. **검수**: 검이(QA)가 결과물과 파일명을 확인합니다. 큰 문제가 있으면 피드백 회의를 열고 수정 일감을 돌려보냅니다(최대 1회).
6. **대표 컨펌**: 마지막 결과물 담당자가 3층 대표실로 올라와 "컨펌 부탁드립니다"라고 보고합니다. 패널에 결과물 파일 링크와 **[승인] [수정 요청]** 버튼이 뜹니다.
   - 수정 요청을 하면 코멘트를 들고 내려가 고친 뒤, 검수를 다시 거쳐 2차 컨펌을 받으러 옵니다.
7. **위키 기록**: 승인되면 손글씨가 2층 집필실에서 `workspace/wiki/<일감ID>.md`에 문서를 남깁니다.

### 직접 지시

직원을 클릭하면 뜨는 카드에서 PM을 거치지 않고 그 사람에게 바로 일을 시킬 수 있습니다.
이렇게 시킨 일도 검수와 대표 컨펌은 똑같이 거칩니다. 하던 일이 있으면 끝난 뒤에 시작합니다.

일이 없을 때 직원들은 휴게실에서 커피를 마시거나 둘이 모여 수다를 떨고, 자료실이나 정보검색실을 둘러봅니다.

## 도구 → 방

| Claude 도구 | 가는 곳 |
|---|---|
| Read / Glob / Grep | 1F 자료실 (손글씨는 2F 위키 서고) |
| WebSearch / WebFetch | 1F 정보검색실 |
| Bash `git …`, 그 밖의 명령 | 1F 서버실 |
| Bash 테스트·린트 | 1F 검수실 |
| Edit / Write | 자기 자리 |
| 질문 대기 | 3F 대표실 입구 |
| 컨펌 요청 | 3F 대표실 (대표 책상 앞) |

## 설정 (환경 변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `MODE` | `sim` | `claude`로 두면 실제 Claude 사용 |
| `PORT` | `4300` | |
| `WORKSPACE` | `./workspace` | 에이전트 작업 폴더 |
| `MAX_PARALLEL` | sim 3 / claude 2 | 동시에 도는 Claude 프로세스 수 |
| `CLAUDE_MODEL` | (CLI 기본값) | 예: `sonnet`, `haiku` |
| `ALLOWED_TOOLS` | 아래 참고 | 실무 에이전트에게 허용할 도구, 쉼표로 구분 |
| `SIM_SPEED` | `1` | 시뮬레이션 속도 배수 |
| `AUTO_DEMO` | `1` | sim 모드에서 일이 없으면 예시 일감을 자동으로 넣음 |
| `ALLOW_ORIGINS` | `https://ceaser501.github.io` | 내 PC 서버에 붙을 수 있는 외부 화면 주소, 쉼표로 구분 |

실무 에이전트의 기본 허용 도구는 Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, TodoWrite와 `git`, `npm`, `node`, `ls`, `mkdir`, `python3`/`python` 명령입니다.
실제 모드에서는 결과물 파일을 패널의 링크(`/files/…`)로 바로 열거나 받을 수 있습니다.
목록에 없는 도구는 헤드리스 모드에서 자동으로 거부됩니다. 기획과 검수 단계는 읽기 위주 도구만 씁니다.

## 구조

```
server.mjs                 HTTP + SSE 서버, 상태 저장(data/state.json)
server/claude-runner.mjs   claude -p 실행, stream-json 파싱
public/js/engine.js        오케스트레이터 (브라우저·Node 공용)
public/js/sim-runner.js    데모용 가짜 러너
public/js/map.js           층별 평면도, 가구, 자리, 길찾기(A*)
public/js/render.js        캔버스 아이소메트릭 렌더러, 캐릭터·말풍선
public/js/app.js           화면 패널과 서버 연결
```

## 역할 추가하기

`engine.js`의 `AGENTS`, `SYSTEM`, `WORK_ROLES`, `ROLE_DESC`에 역할을 추가하고, `map.js`의 `f.seats`에 자리를 하나 지정하면 됩니다.
`ROLE_DESC`의 설명을 보고 PM이 그 사람을 쓸지 정합니다.
