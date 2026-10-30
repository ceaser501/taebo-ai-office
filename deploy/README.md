# 밖에서 쓰는 사무실 (내 맥 + ngrok 무료 고정 주소)

내 맥에서 서버를 띄우고, ngrok 무료 고정 주소로 밖에서 접속합니다. 서버 비용은 0원이고 카드도 필요 없습니다.

| 주소 | 하는 일 |
|---|---|
| `https://<내 도메인>/` | **태보 AI 사무실**: 일감을 주면 AI 팀이 Claude로 일합니다 |
| `https://<내 도메인>/people/` | **사람 사무실**: 내 Claude Code 세션(claude.ai 클라우드 세션 포함)이 직원으로 나옵니다 |

- **맥이 켜져 있고 `npm run up`이 떠 있는 동안만** 밖에서 접속됩니다. 실행 중에는 맥이 잠들지 않게 막아 줍니다. 덮개를 닫으면 잠들 수 있습니다.
- Claude 사용료는 `.env`에 `ANTHROPIC_API_KEY`를 넣으면 **API 크레딧**에서, 비워 두면 맥의 **claude 로그인(구독)**에서 나갑니다.
- 결과물(PPT 등)은 맥의 `workspace/` 폴더에, 상태는 `data/`에 남습니다.

## 1. ngrok 준비 (처음 한 번)

1. https://dashboard.ngrok.com/signup 에서 무료로 가입합니다. 카드는 필요 없습니다.
2. 맥에 설치하고 내 계정을 연결합니다. 토큰은 대시보드의 **Your Authtoken**에 있습니다.
   ```bash
   brew install ngrok
   ngrok config add-authtoken <내 토큰>
   ```
3. 대시보드의 **Domains**에서 무료 고정 도메인을 확인합니다(무료 계정에 하나씩 주어집니다). 예: `taebo-office.ngrok-free.app`

## 2. 설정 파일 만들기 (처음 한 번)

레포 폴더에서:

```bash
cp .env.example .env
open -e .env
```

| 이름 | 값 |
|---|---|
| `OFFICE_PASSWORD` | 화면 비밀번호 (필수) |
| `OFFICE_TOKEN` | 세션 보고 토큰. 비밀번호와 다른 값 (`openssl rand -hex 24`로 만들기) |
| `NGROK_DOMAIN` | 1-3에서 확인한 도메인 |
| `ANTHROPIC_API_KEY` | API 크레딧을 쓰려면 넣습니다. 비우면 claude 로그인을 씁니다 |
| `CLAUDE_MODEL`, `MAX_PARALLEL` | 비용 조절용. 기본은 `sonnet`, `2` |

`.env`는 git에 올라가지 않습니다.

## 3. 켜기

```bash
git pull
npm run up
```

화면에 밖에서 쓸 주소와 클라우드 설정값이 나옵니다. 끌 때는 `Ctrl + C`입니다.

- 처음 브라우저로 열면 ngrok 무료 계정 안내 화면이 한 번 나옵니다. **Visit Site**를 누르면 됩니다.
- 그다음 비밀번호를 넣으면 들어갑니다. 로그인은 30일 동안 유지됩니다.

## 4. 클라우드 세션이 사람 사무실에 나오게

claude.ai의 Claude Code 클라우드 세션은 **레포의 `.claude/settings.json` 훅**을 실행합니다. 이 훅이 세션 상태를 내 맥 서버로 보냅니다.

1. **보고할 레포에 훅 넣기**: 이 레포(`taebo-ai-office`)에는 이미 들어 있습니다. 다른 레포는 이 레포 폴더에서 아래를 실행하고, 그 레포에 커밋, 푸시하세요.
   ```bash
   node cloud-report/install.mjs ../다른-레포
   ```
2. **클라우드 환경 설정**: claude.ai/code에서 세션 제목 줄의 환경 메뉴 → Edit
   - **Environment variables**: `OFFICE_URL=https://<내 도메인>`, `OFFICE_TOKEN=<.env의 OFFICE_TOKEN>`
   - **Network access**: Allowed domains에 `<내 도메인>`을 추가합니다. Allow package managers 체크는 그대로 둡니다.
3. 새 세션을 열면 그 레포 이름의 직원이 사람 사무실에 출근합니다.

맥 터미널의 Claude Code도 보이게 하려면 `~/.zshrc`에 아래 두 줄을 넣어 두세요. 같은 레포라면 클라우드 세션과 한 직원으로 합쳐집니다.

```bash
export OFFICE_URL=http://localhost:4300
export OFFICE_TOKEN=<.env의 OFFICE_TOKEN>
```

### 보내는 것과 보내지 않는 것

- **보냄**: 세션 ID, 레포 이름, 사건 종류(시작·질문 받음·도구 사용·승인 대기·끝), 도구 이름과 짧게 자른 인자(파일 이름, 명령 설명, 검색어 앞부분), claude.ai 세션 링크
- **보내지 않음**: 프롬프트 내용, 파일 내용, 명령 출력
- 맥 서버가 꺼져 있으면 보고는 조용히 버려지고, Claude 작업에는 영향이 없습니다.

## 안전

- 화면과 API는 모두 로그인이 필요합니다. 보고(`/api/report`)만 토큰으로 받고, 토큰으로는 상태 보고만 할 수 있습니다. 일을 시키거나 화면을 볼 수는 없습니다.
- `npm run up`은 비밀번호나 토큰이 없으면 밖에 공개하지 않습니다.
- 비밀번호나 토큰이 새면 `.env` 값을 바꾸고 다시 켜면 됩니다. 클라우드 환경의 `OFFICE_TOKEN`도 같이 바꾸세요.
- ngrok 무료 계정은 월 데이터 양 같은 한도가 있습니다. 혼자 쓰는 정도는 충분하지만, 정확한 한도는 ngrok 요금 페이지에서 확인하세요.

## (선택) Supabase에도 보관

맥 디스크에도 남기 때문에 필요 없지만, 맥을 바꾸거나 백업하고 싶으면 `.env`에 넣으세요. `oneteam-vote` 프로젝트에 `office_state` 테이블과 `office-files` 버킷이 준비돼 있습니다(`deploy/supabase.sql`).

```
SUPABASE_URL=https://gxyckkinlygeasruapmj.supabase.co
SUPABASE_SECRET_KEY=<대시보드 → Project Settings → API Keys → Secret key>
```
