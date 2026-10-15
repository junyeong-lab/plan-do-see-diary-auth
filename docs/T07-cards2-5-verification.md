# SKT ALEPH T07 카드 2~5 — 인증·권한·5일 연구 검증

검증 기준: 2026-10-15. **공개 문서에는 비밀번호 원문·저장 해시 전체·JWT·세션/쿠키 값을 싣지 않습니다.** 실제 bcrypt 저장값은 비공개 ZIP으로만 제한 공유합니다.

## ① 무엇으로 붙였나
- **Supabase Auth**, `@supabase/supabase-js@2.117.3` (프런트), Supabase PostgreSQL Row Level Security, JWT access/refresh token.
- 이메일·비밀번호 가입은 `index.html` `signUp()`, 로그인은 `signInWithPassword()`, 로그아웃은 `signOut()`. 토큰 발급과 비밀번호 해시는 Supabase Auth에 위임했습니다.
- `api/secure-plan.js`: 비로그인 401, 본인 Plan GET 200, 타 계정 Plan GET/PATCH/DELETE 404를 검증하는 서버 경로. 실제 주인 판정은 JWT와 Supabase RLS 정책을 함께 사용합니다.

## ② 왜 이 방법을 골랐나
- 비밀번호 해시, salt, JWT 서명, 인증의 기본 동작을 직접 구현할 때 발생할 수 있는 오류를 줄이기 위해 전문 인증 서비스를 선택했습니다.
- DB의 `auth.users.encrypted_password`: bcrypt `$2a$10$` 형식(60자), 같은 원문 비밀번호의 두 계정에 서로 다른 해시 저장을 확인했습니다.
- `t07_password_epoch` 및 `t07_token_is_current()`: 비밀번호 변경 전에 발급된 JWT는 보호된 테이블을 조회하지 못하도록 RLS를 보완했습니다.
- 비밀번호는 **TLS를 통한 로그인 요청 본문에 전송될 수 있으며**, 이 사실을 숨기지 않습니다. 캡처·로그·제출문에서만 민감한 본문을 제외하거나 마스킹합니다.

## ③ 무엇을 어디에 고쳤나
| 동작 | 파일·구현 |
|---|---|
| 가입 | `index.html` `signupBtn`, `client.auth.signUp()` |
| 로그인 | `index.html` `loginBtn`, `signInWithPassword()` |
| 로그인 상태 | `index.html` `getSession()`, `showLoggedIn()`, `onAuthStateChange()` |
| 로그아웃 | `index.html` `logoutBtn`, `signOut()` |
| 자기 자료 조회 | `index.html` `load()` 및 `user_id` 필터 |
| 사용자 Plan 선택 | `index.html` `#planChooser`·`#activePlanSelect` (여러 Plan을 한 계정에서 선택) |
| DB 접근제어 | `public` 8개 업무 테이블의 `t07_active_owner`: `auth.uid() = user_id`와 `t07_token_is_current()` |
| 동일 주소 HTTP 차단 | `api/secure-plan.js` 및 `t07-security-check.html` |
| JSON 내보내기 | `index.html` `exportBtn`, 8개 테이블 |
| 계정 삭제 안내·함수 | `index.html` 삭제 메뉴 및 `t07_delete_my_account()` |
| 연구 합계·평균 | `index.html` `#studyMetrics`, 실제 실행 기록과 예상시간 대조 |

## ④ 안 열리는 것을 확인한 기록 — 성공과 거절
**실제 실행 결과, 사용자 PC의 PowerShell 파일에서 민감정보 없이 저장한 JSON 기준:**

| 검증 | 성공 요청 | 상대·비로그인 거절 |
|---|---|---|
| 자기 vs 타인 읽기 A→B | 본인 `GET` 200 | 타인 `GET` 404 |
| 자기 vs 타인 읽기 B→A | 본인 `GET` 200 | 타인 `GET` 404 |
| 타인 수정 A→B/B→A | 본인 자료 조회 200 | 상대 `PATCH` 404 |
| 타인 삭제 A→B/B→A | 본인 자료 조회 200 | 상대 `DELETE` 404 |
| 비로그인 | 로그인된 사용자 본인 `GET` 200 | 토큰 없는 `GET` 401 |
| 계정 사칭 | 자기 JWT로 본인 자료 조회 200 | 타인 ID를 URL·헤더에 넣은 요청 404 |

- **18/18 PASS**: 양쪽 계정 본인 Plan 조회 200, 타인 GET/PATCH/DELETE 404, URL/헤더 사칭 404, 자료 개수·제목은 거절 전후 동일, 비로그인 401.
- **로그아웃 동일 토큰**: 같은 요청 주소·같은 GET·같은 이전 JWT로 전후 **200 → 401**, 중간 `POST /auth/v1/logout?scope=global` **204**.
- **비밀번호 변경 동일 토큰**: 변경 전 GET **200**, 변경 후 같은 JWT GET **404** (RLS), 원래 비밀번호 복원·재로그인 **200**, **7/7 PASS**.
- **추가 실측 완료(2026-10-15 09:34 KST): PowerShell `T07_FINAL_remaining_tests_FIXED2.ps1` 22/22 PASS.** 본인 GET 200, 타인 GET 404, URL·헤더·PATCH 본문 `user_id` 동시 사칭 요청 404, 기존 Plan 원본 변경 없음. 검증용 임시 Plan만 POST 201 → GET 200 → PATCH 204 → DELETE 204 → 재조회 404로 검증했고, 상대 PATCH·DELETE는 각각 404. `TemporaryPlanDeleted: true`, `FailurePhase: null`, `SecretsIncluded: false`. 로그인 요청 URL·응답 본문·응답 헤더·공개 페이지 HTML·Plans 응답에서 **입력된 비밀번호 원문이 나타나지 않음**을 PC에서 확인. 이 결과는 확인한 응답 범위에 한정하며, 로그인 요청 Payload의 비밀번호나 모든 운영 로그의 부재를 뜻하지 않음.
- RLS 자체는 `200 + []`을 반환할 수도 있으므로 HTTP **404가 검증된 대상은 `/api/secure-plan`입니다**.
- `pds_diary` 레거시 테이블의 공개 조회는 추가 제한 정책으로 차단. 비로그인 역할 쿼리에서 변경 전 1건, 변경 후 0건.
- 공개 소스 및 Git 변경 커밋의 알려진 비밀키/JWT 패턴 검사에서 의심 일치 0건. Supabase 인증·감사·REST·엣지 로그 231건 중 JSON형 비밀번호 값/서버 비밀키 패턴 의심 일치 0건. **패턴 기반 검사 결과는 전수 부재 보장이 아닙니다**.

## ⑤ AI와 나의 역할
1. **AI에게 맡긴 일:** GitHub·Supabase·Vercel 코드/DB/배포 점검, 보안검증 페이지와 PowerShell 작성, 보안정책/문서 보완, 증빙 ZIP 구성.
2. **내가 직접 판단한 일:** 연구 질문·운동 내용·5일 기록·계획 규칙 변경, 실제 PC·브라우저에서 가입/로그인/로그아웃/보안 검증 수행.
3. **따르지 않은 제안:** 실제 검증이 없는 조건을 완료로 처리하지 않았으며, 운동 기록이 들어 있는 기존 계정을 삭제하지 않았습니다.

## ⑥ 아직 못 막았거나 독립 검증하지 못한 것
- 비밀번호 변경 시 **T07 앱의 RLS 자료 조회**는 이전 JWT를 차단하는 것이 실측됐지만, Supabase 및 모든 외부 서비스의 JWT 전역 무효화를 의미하지는 않습니다.
- C113·C46의 공개 소스·Git 전 이력·공개 제출물·최신 Vercel 빌드 로그를 확인했고, 해당 범위에서 원문 비밀값은 발견되지 않았습니다. 모든 시기의 비공개 플랫폼 내부 로그에 비밀값이 절대 존재하지 않는다는 보장은 별도 사안입니다.
- 비밀번호 무차별 대입 방어, 두 번째 인증 수단, 비밀번호 재설정의 실제 악용 방어는 별도로 완전 검증하지 못했습니다. 계정 공격과 탈취 위험이 남습니다.
- Supabase 보안 점검에서 내부 트리거 `t07_capture_password_change()`의 익명 EXECUTE 권한 경고가 관찰됐습니다. 외부 RPC가 해당 함수에 접근하지 못하도록 실행 권한 회수가 권장됩니다(연결 도구의 변경 제한으로 아직 미조치).
- URL·헤더·본문 소유자 위조와 임시 Plan 정상 PATCH/DELETE는 **22/22 PASS로 검증 완료**. 다만 본 테스트는 한 로그인 세션의 보호 API와 반환 데이터를 확인한 것으로 다른 모든 앱/API 경로의 동작을 보장하지 않습니다.

## T07 5일 실험
| 날짜 (KST) | 예상분 | 실제분 | 절대오차분 |
|---|---:|---:|---:|
| 2026-10-09 | 90 | 90 | 0 |
| 2026-10-10 | 80 | 80 | 0 |
| 2026-10-11 | 80 | 80 | 0 |
| 2026-10-12 | 80 | 60 | 20 |
| 2026-10-13 | 60 | 60 | 0 |
| 합계 | **390** | **370** | **20** |
- 질문: **계획한 운동시간과 실제 운동시간의 차이를 줄일 수 있을까?**
- 지표 및 규칙: 운동시간 절대오차(분), `ABS(실제−예상)`; **평균 절대오차 4.00분**, 실제 SEE 화면과 동일.
- 계획 규칙은 2일차 종료 뒤·3일차 기록 앞 `2026-10-10 22:23:33 KST`에 1회 변경. 이유는 그날 실제 시간이 변할 수 있고, 2일차 예상이 운동 후 입력됐기 때문입니다.
- 결측: 표기 후 계산 제외. 중복: 고유 Task/실행 기록 확인 후 한 번 계산. 이상치: 원본 유지·원인 분석. 평균: 소수점 둘째 자리 표시. 주 시작 요일: **월요일**.
- JSON 8개 테이블 실제 다운로드 확인, 비로그인 첫 화면 및 계정 삭제 안내 화면 캡처 확보.

## T06 소스와 공개 제출 조건
- 최종 T06 commit: `0bf0cc64a3b30283b3c29020e2a667b7f7681f5f`.
- T07 Git 조상으로 실제 병합돼 GitHub compare `merge_base`가 해당 커밋과 일치하고 `behind_by=0`입니다.
- 제출 결과물: **https://plan-do-see-diary-auth-ruddy.vercel.app/**
- 소스: **최종 GitHub 40자리 commit 고정 URL**을 모든 변경·배포 확인 후 제출합니다. 별도 프로젝트 URL은 제출하지 않습니다.
- 비공개 bcrypt 해시/JSON 원본/사용자 계정 정보는 공개 Git 저장소에 포함하지 않습니다.

## 재현·통과·실패 네 줄
1. **어디로:** 위 Vercel 결과물 URL을 새 시크릿 창에서 엽니다.
2. **무엇을:** 비로그인 첫 화면 → 로그인 후 SEE 5일 자료 확인 → `/t07-security-check.html`에서 소유권 검증.
3. **통과:** 로그인 전 자료 비공개, 5일 합계 **390/370/20**, 평균 **4.00분**, API 본인 200·타인 404·비로그인 401.
4. **실패:** 비로그인 기록 노출, 집계 불일치, 권한 검증 FAIL/오류.

## 2026-10-15 — C113/C46 재현 가능한 최종 보안 점검
- **C113 확인:** 브라우저 `index.html`(사용자 제공 실제 481줄)과 공개 API·Git 이력에 서버용 `service_role`/`sb_secret_` 값, JWT 서명키·실제 JWT 원문 없음. `sb_publishable_`은 공개 클라이언트 키.
- **C46 확인:** GitHub Actions [full-history audit](https://github.com/junyeong-lab/plan-do-see-diary-auth/actions/runs/38666641793) 성공 — Git 객체 110개/Blob 30개/441,311바이트, 비밀값 패턴 일치 0건. 공개 증빙 ZIP 22개 파일 중 검색 가능한 18개 검사도 검출 0건. SHA-256 `67490fc0821baa1560d763069ab9eea8ec6f5fcbb9feab7b949b2828cf2cf8d2`.
- **Vercel 확인:** 사용자 계정으로 최신 배포 `6b30763`의 Deploy Logs 전체 확인: 빌드/배포 완료, 비밀 원문 미포함. 같은 배포 Runtime Logs 화면 해당 시간대 기록 없음. 무기한 전체 로그 무결성까지 주장하는 것은 아님.
- 내부 권한 추가 검증: `public.t07_capture_password_change()`를 anon 및 authenticated가 직접 실행할 권한은 모두 `false`.
- 검사 절차와 적용 범위: [docs/T07-final-audit.md](./T07-final-audit.md), [tools/t07_secret_audit.py](../tools/t07_secret_audit.py), [.github/workflows/t07-public-secret-audit.yml](../.github/workflows/t07-public-secret-audit.yml).
