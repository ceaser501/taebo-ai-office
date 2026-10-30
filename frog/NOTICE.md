# 출처와 바꾼 점

이 폴더는 **claude-3d-frog-office**를 MIT 라이선스에 따라 가져온 것입니다.

- 원본: https://github.com/d-onworks/claude-3d-frog-office
- 가져온 커밋: `e00f953`
- 라이선스: [LICENSE](LICENSE) (MIT, Copyright (c) 2026 claude-3d-frog-office contributors). 원본 저작권 고지를 그대로 둡니다.

## 태보에서 바꾼 점

원본 동작은 그대로 두고, GitHub Pages에서 볼 수 있게 하는 부분만 더했습니다.

| 파일 | 바꾼 점 |
|---|---|
| `web/office-demo.js` | 새 파일. `server/demo.mjs`의 가짜 데이터를 브라우저에서 만듭니다. 127.0.0.1·localhost가 아닌 주소에서 열거나 `?demo=1`일 때만 켜집니다 |
| `web/office-view.js` | 브라우저 데모가 켜져 있으면 `/api/office` 대신 그 데이터를 씁니다 |
| `web/i18n.js` | 브라우저 데모에서는 `/api/config`를 읽지 않습니다 |
| `web/index.html` | `office-demo.js`를 불러옵니다 |
| `index.html` | 새 파일. `web/`으로 넘겨 주는 진입 페이지입니다 |
| `docs/video/` | 용량 때문에 빼었습니다. README의 영상 링크는 원본 저장소를 가리킵니다 |

내 PC 서버(`http://127.0.0.1:4777`)로 열면 원본과 똑같이 동작합니다.
