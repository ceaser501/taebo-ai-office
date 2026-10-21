# 태보 AI 사무실

Claude 에이전트 팀이 일하는 모습을 아이소메트릭 사무실로 보여 주는 관제 대시보드입니다.
일감을 시키면 PM이 일을 쪼개서 회의를 열고, 팀원들이 실제 Claude Code로 작업합니다.
캐릭터는 쓰는 도구에 따라 방을 옮겨 다닙니다.

## 실행

```bash
npm start                # 시뮬레이션 모드 (Claude 호출 없음, 비용 0)
npm run start:claude     # 실제 Claude Code로 일함 (토큰 비용 발생)
```

브라우저에서 http://localhost:4300 을 열면 됩니다. Node 20 이상이 필요하고, 설치할 패키지는 없습니다.

`public/index.html`만 정적으로 열어도 동작합니다. 이 경우 서버가 없으면 브라우저 안에서 데모 엔진이 돌아갑니다.

실제 모드를 쓰려면 `claude` CLI가 설치되어 있고 로그인(또는 `ANTHROPIC_API_KEY`)이 되어 있어야 합니다.

## 일이 흘러가는 순서

1. **접수**: 대표님(사용자)이 일감을 등록합니다.
2. **기획**: 마로(PM)가 Claude로 일감을 역할별 하위 일감으로 쪼갭니다. 회의 대사도 이때 Claude가 씁니다.
3. **킥오프 회의**: 담당자들이 회의실로 걸어가 모이고, 대사를 말풍선으로 주고받습니다.
4. **실무**: 한결(백엔드), 다온(프론트), 보라(디자인)가 각자 `claude -p`로 작업합니다. 같은 일감은 `workspace/<일감ID>/` 폴더를 함께 씁니다.
   - 대표님 결정이 필요하면 3층 대표실 입구로 올라가서 기다립니다. 오른쪽 "대표님 기다림"에서 답하면 같은 세션(`--resume`)으로 이어서 작업합니다.
5. **검수**: 검이(QA)가 결과물을 확인합니다. 문제가 있으면 피드백 회의를 열고 수정 일감을 돌려보냅니다(최대 1회).
6. **위키 기록**: 손글씨가 2층 집필실에서 `workspace/wiki/<일감ID>.md`에 문서를 남깁니다.
7. **보고**: 마로가 3층 대표실로 올라가 완료를 보고합니다.

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

실무 에이전트의 기본 허용 도구는 Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, TodoWrite와 `git`, `npm`, `node`, `ls`, `mkdir`, `python3` 명령입니다.
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

`engine.js`의 `AGENTS`, `SYSTEM`, `WORK_ROLES`에 역할을 추가하고, `map.js`의 `f.seats`에 자리를 하나 지정하면 됩니다.
