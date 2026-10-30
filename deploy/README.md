# 밖에서 쓰는 사무실 (Hugging Face Spaces + Supabase, 무료)

서버 하나에 두 사무실이 올라갑니다.

| 주소 | 하는 일 |
|---|---|
| `https://<계정>-taebo-office.hf.space/` | **태보 AI 사무실**: 일감을 주면 AI 팀이 Claude API로 일합니다 |
| `https://<계정>-taebo-office.hf.space/people/` | **사람 사무실**: 내 Claude Code 세션(claude.ai 클라우드 세션 포함)이 직원으로 나옵니다 |

- 서버(Hugging Face Space 무료 CPU)와 저장소(Supabase 무료)는 돈이 들지 않습니다.
- **Claude API 사용료는 내 크레딧에서 나갑니다.**
- 무료 Space는 한동안 안 쓰면 잠들고, 첫 접속 때 깨어나는 데 시간이 걸립니다. 재시작하면 디스크가 비지만, 상태와 결과물은 Supabase에 남습니다.

## 준비물

- **Supabase**: `oneteam-vote` 프로젝트에 `office_state` 테이블과 `office-files` 버킷이 이미 만들어져 있습니다(`deploy/supabase.sql`).
  - Project URL: `https://gxyckkinlygeasruapmj.supabase.co`
  - 비밀 키: 대시보드 → Project Settings → API Keys → **Secret keys** (`sb_secret_…`). 옛 화면이라면 `service_role` 키.
- **Anthropic API 키**: https://console.anthropic.com → API Keys
- **비밀번호와 토큰 두 개**: 직접 정해도 되고, 터미널에서 `openssl rand -hex 24`로 만들어도 됩니다.
  - `OFFICE_PASSWORD`: 화면에 들어갈 때 쓰는 비밀번호
  - `OFFICE_TOKEN`: 세션 보고용 토큰. 비밀번호와 다르게 정하세요.

## 1. Hugging Face Space 만들기

1. https://huggingface.co 가입(무료) → 오른쪽 위 **New → Space**
2. 이름은 `taebo-office`, **SDK는 Docker → Blank**, 공개 범위는 **Public**, 하드웨어는 **CPU basic (Free)**로 만듭니다.
   - Public이어야 보고 훅이 들어올 수 있습니다. 화면은 비밀번호로 막혀 있습니다.
3. Space의 **Files → Add file → Upload files**에서 이 레포의 두 파일을 올립니다. 이름은 그대로 둡니다.
   - `deploy/hf/Dockerfile`
   - `deploy/hf/README.md` (기존 README.md를 덮어씁니다)
4. **Settings → Variables and secrets**에서 **Secrets**에 아래 값을 넣습니다.

   | 이름 | 값 |
   |---|---|
   | `ANTHROPIC_API_KEY` | Anthropic API 키 |
   | `OFFICE_PASSWORD` | 화면 비밀번호 |
   | `OFFICE_TOKEN` | 세션 보고 토큰 |
   | `SUPABASE_URL` | `https://gxyckkinlygeasruapmj.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Supabase 비밀 키 |

   **Variables**(선택):

   | 이름 | 예 | 뜻 |
   |---|---|---|
   | `CLAUDE_MODEL` | `sonnet` | 직원들이 쓸 모델. 비용을 아끼려면 `sonnet`이나 `haiku` |
   | `MAX_PARALLEL` | `1` | 동시에 도는 Claude 작업 수 |

5. 빌드가 끝나면(처음엔 몇 분) `https://<계정>-taebo-office.hf.space`에 들어가 비밀번호로 로그인합니다.

## 2. GitHub에 푸시하면 자동으로 다시 빌드 (선택)

Dockerfile이 빌드할 때마다 GitHub `main`의 최신 코드를 받습니다. 푸시할 때 Space를 새로 빌드하도록 걸어 두면 됩니다.

1. Hugging Face → Settings → **Access Tokens** → Write 권한 토큰을 만듭니다.
2. 이 GitHub 레포 → Settings → Secrets and variables → Actions
   - **Secrets**: `HF_TOKEN` = 위 토큰
   - **Variables**: `HF_SPACE` = `<계정>/taebo-office`
3. 이제 `main`에 푸시하면 `.github/workflows/deploy-hf.yml`이 Space를 새로 빌드합니다. 이 값들이 없으면 워크플로는 아무것도 하지 않고 끝납니다.
   - 걸어 두지 않았다면 Space의 Settings → **Factory rebuild**로 직접 새로 빌드하면 됩니다.

## 3. 클라우드 세션이 사람 사무실에 나오게

claude.ai의 Claude Code 클라우드 세션은 **레포의 `.claude/settings.json` 훅**을 실행합니다. 이 훅이 세션 상태를 서버로 보냅니다.

1. **보고할 레포에 훅 넣기**: 이 레포(`taebo-ai-office`)에는 이미 들어 있습니다. 다른 레포는 이 레포 폴더에서 아래를 실행한 뒤 그 레포에 커밋하세요.
   ```bash
   node cloud-report/install.mjs ../다른-레포
   ```
2. **클라우드 환경 설정**: claude.ai/code에서 세션 제목 줄의 환경 메뉴 → Edit
   - **Environment variables**: `OFFICE_URL=https://<계정>-taebo-office.hf.space`, `OFFICE_TOKEN=<보고 토큰>`
   - **Network access**: Allowed domains에 `<계정>-taebo-office.hf.space`를 추가합니다. Allow package managers 체크는 그대로 둡니다.
3. 새 세션을 열면 그 레포 이름의 직원이 사람 사무실에 출근합니다. 하는 일, 승인 대기, 서브에이전트, 쉬는 중이 실시간으로 바뀝니다.

내 맥 터미널의 Claude Code도 같은 훅으로 보고됩니다. 셸에 `OFFICE_URL`과 `OFFICE_TOKEN`만 export해 두면 됩니다.

### 보내는 것과 보내지 않는 것

- **보냄**: 세션 ID, 레포 이름, 사건 종류(시작·질문 받음·도구 사용·승인 대기·끝), 도구 이름과 짧게 자른 인자(파일 이름, 명령 설명, 검색어 앞부분), claude.ai 세션 링크
- **보내지 않음**: 프롬프트 내용, 파일 내용, 명령 출력

## 비용과 안전

- **Claude 사용료**: 태보 사무실은 일감 하나에 Claude를 여러 번 부릅니다(기획, 담당자별 작업, 검수, 위키). 처음엔 `CLAUDE_MODEL=sonnet`, `MAX_PARALLEL=1`을 권합니다. 화면 위의 "누적 $"에서 쓴 금액이 보입니다.
- **로그인**: 화면과 API는 모두 로그인이 필요합니다. 보고(`/api/report`)만 토큰으로 받습니다. 토큰은 상태 보고만 할 수 있고, 일을 시키거나 화면을 볼 수는 없습니다.
- **Supabase**: 공개 키로는 읽을 수 없게 정책을 두지 않았습니다. 서버의 비밀 키만 씁니다.
- **유출 시**: 비밀번호나 토큰이 새면 Space Secrets에서 값만 바꾸면 됩니다. 재시작되면서 바로 적용됩니다.
