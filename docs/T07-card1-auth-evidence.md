# SKT ALEPH T07 카드 1 — 인증 구현 및 실측 증빙

검증 기록 갱신: 2026-10-15. 앱: [Plan·Do·See Diary](https://plan-do-see-diary-auth-ruddy.vercel.app/)

## C91·C92: 방식과 라이브러리
- 직접 로그인 서버를 구현하지 않고 **Supabase Auth**를 사용했습니다.
- 브라우저 SDK는 **@supabase/supabase-js 2.117.3**으로 버전을 고정했습니다.
- 로그인 사용자의 JWT와 PostgreSQL **Row Level Security(RLS)**로 데이터 소유권을 검증합니다.

## C93: 선택 이유·비교
- 비밀번호 해시와 salt, 세션 처리 등을 자체 코드로 만들지 않고 널리 사용되는 인증 서비스에 맡겼습니다.
- 다른 선택지인 자체 인증 서버 구현은 해시·토큰 서명·수명·패치 유지 등 운영 부담이 큽니다.
- 이 비교는 **기술적 대안 설명**이며 당시 사용자가 실제로 검토한 기록이라고 주장하지 않습니다.

## C94~C96: 가입·로그인·로그아웃
- `index.html` `client.auth.signUp`(가입), `signInWithPassword`(로그인), `signOut`(로그아웃).
- 사용자 실행 기록: 로그인 `POST /auth/v1/token` → **200**, 로그아웃 `POST /auth/v1/logout?scope=global` → **204**.
- PowerShell에서 **동일 URL·메서드·기존 JWT**로 로그아웃 전 **200**, 로그아웃 후 **401** 확인.
- 비밀번호 변경 전후 기존 JWT 접근은 DB의 `t07_token_is_current()` 정책을 적용하여 **200→404** 확인. 원래 비밀번호 복원 및 로그인도 확인(7/7 PASS).

## C97~C99: 비로그인·중복 가입·인증 실패
- 새 시크릿 창에서 Vercel 첫 화면은 열리고, 로그인 전 PLAN·DO·SEE 개인 기록은 숨겨집니다(사용자 캡처).
- 가입된 이메일 재가입은 `이미 가입된 이메일입니다. 로그인해주세요.` 문구로 안내하며, 기존 계정 중복 여부를 검토했습니다.
- 잘못된 비밀번호·없는 계정에 인증 실패 메시지를 표시했습니다.
- 로그인 이후 비밀번호 입력 DOM 값은 비워지며, 로그인 실패 시에도 비워집니다.

## C100 및 T06 계승
- 5일 운동 기록과 T06의 기존 Plan·Do·See 데이터는 삭제하지 않았습니다.
- T06 최종 소스 커밋: `0bf0cc64a3b30283b3c29020e2a667b7f7681f5f`.
- T07 Git 이력의 실제 조상에 위 커밋 포함: GitHub compare의 merge base가 T06 커밋과 일치, behind 0.
- T07은 T06 UI와 데이터 모델에 인증·자기 소유 자료 제한·연구·내보내기·삭제 안내 기능을 더했습니다.

## 코드 흐름
| 기능 | 파일과 핵심 함수 |
|---|---|
| 비로그인 진입 화면 | `index.html` `#authScreen`, `showLoggedOut()` |
| 신규 가입 | `index.html` `signupBtn`, `client.auth.signUp()` |
| 로그인 | `index.html` `loginBtn`, `signInWithPassword()`, `showLoggedIn()` |
| 토큰과 로그인 상태 | `index.html` `getSession()`, `onAuthStateChange()` |
| 로그아웃 | `index.html` `logoutBtn`, `signOut()` |
| 사용자별 데이터 | `index.html` `load()` 및 Postgres `t07_active_owner` RLS |
| HTTP 401·200·404 | `api/secure-plan.js` |
| 인증/소유권 자동 확인 | `t07-security-check.html` |

## 실제 검사 근거와 범위
- 두 계정 각 2개 Plan 생성 확인, 양방향 타인 GET/PATCH/DELETE HTTP 404.
- PowerShell **18/18 PASS**: 비로그인 401, 본인 200, 타인 조회·수정·삭제 404, 헤더·쿼리 위조 차단, 변경 전후 자료 불변, 기존 토큰 로그아웃 후 401.
- 비밀번호 변경/원복 실측 **7/7 PASS**: 같은 토큰이 비밀번호 변경 전 200, 후 404.
- 로그와 Git 코드의 비밀정보 검사는 정규식·보유된 범위에 한정되므로 **전체 생태계에 비밀정보가 절대 없다고 주장하지 않습니다**.

## AI와 내 판단
- **AI가 수행:** GitHub·Supabase·Vercel 코드/정책 수정, 검증 코드와 증빙 문서 작성.
- **사용자가 판단:** 연구 주제·운동 기록·규칙 변경, 실제 로그인·화면·PowerShell 검증 수행.
- **채택하지 않은 제안:** 실측되지 않은 조건의 완료 처리, 운동 기록이 있는 실제 계정 삭제.

## 아직 남은 한계
- 로그인 요청의 **본문에는 TLS로 암호화되어 전송되는 비밀번호가 포함**됩니다. 따라서 개발자도구 Network Payload를 캡처할 때는 반드시 가려야 합니다.
- Supabase 전체 운영 로그·Vercel 배포 원본 파일에 비밀번호/키가 절대로 없다는 보장은 아니며, 검사한 범위에서만 판단합니다.
- 보안 API 응답 404와 Supabase REST RLS의 200+빈 목록은 서로 다른 응답 경로입니다.
- 별도 `t07_capture_password_change()` 내부 트리거 함수의 익명 실행 권한은 추가로 회수해야 합니다(운영 보안 권고).
