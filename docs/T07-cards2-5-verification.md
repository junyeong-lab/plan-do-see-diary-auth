# SKT ALEPH T07 — 인증 구현 설명서 및 확인 기록

## ① 무엇으로 붙였나
- Supabase Auth(이메일·비밀번호), supabase-js 2.x, PostgreSQL RLS.
- 서버 측 소유권 및 HTTP 응답 검증 경로: `api/secure-plan.js` (검증 UI: `t07-security-check.html`).
- 사용자는 JWT access token 및 refresh token 기반으로 인식한다.

## ② 왜 골랐나
- 비밀번호 저장·해시·솔트·로그인 처리를 직접 구현하지 않고 검증된 Supabase Auth에 위임해 실수를 줄이고, RLS로 자료 소유권을 데이터베이스에서 제한하기 위함.
- DB의 저장값 두 개는 bcrypt(`$2a$10$` 형식, 각 60자), 서로 다름. 사용자가 두 계정에 같은 비밀번호를 사용했다고 확인함. 해시/비밀번호 원문은 공개 소스 및 제출문에 넣지 않음.

## ③ 어디를 고쳤나 (가입·로그인·로그아웃·조회)
- 가입: `index.html` — `client.auth.signUp`.
- 로그인: `index.html` — `client.auth.signInWithPassword`, `getSession`, `showLoggedIn`.
- 로그아웃: `index.html` — `client.auth.signOut`, `onAuthStateChange`.
- 조회: `index.html` — `load()`, `client.from('plans'/'tasks'/...)`, `eq('user_id', currentUser.id)`; PostgreSQL `pg_policies`의 8개 테이블 주인 조건 `auth.uid()=user_id`.
- 보호 HTTP 엔드포인트: `api/secure-plan.js` (GET/PATCH/DELETE, 비로그인 401, 본인 조회 200, 남의 Plan 404). 원래의 Supabase PostgREST 요청은 RLS 필터에 따라 200+빈 목록을 반환할 수도 있으므로 두 경로를 혼동하지 않음.
- JSON 내보내기: `index.html` `exportBtn` (8개 테이블).
- 자기 계정 및 자료 삭제: `index.html`의 영구 삭제 메뉴와 Supabase `t07_delete_my_account` 함수.

## ④ 안 열리는 것을 확인한 기록
- 사용자 제공 캡처: 비로그인 시크릿 창에서 로그인 화면만 표시, PLAN·DO·SEE 비표시.
- 계정 A(Gmail)에 Plan 2개, 계정 B(Naver)에 Plan 2개 존재. 역할 변경 SQL 쿼리에서 A→B/B→A의 남의 Plan 조회 0개. 양방향 UPDATE/DELETE 시도 후 원본 Plan 1·3·4·5가 모두 그대로 있음을 관리자 조회로 확인.
- A 로그인 후 `/t07-security-check.html` 자동 실행의 사용자 보고 결과:
  - 비로그인 `GET /api/secure-plan?id=[타인 ID]` → **401**
  - 본인 `GET /api/secure-plan?id=[본인 ID]` → **200**
  - 남의 Plan `GET` → **404**, `PATCH` → **404**, `DELETE` → **404**
  - 화면 최종 결과 **PASS**. 두 요청의 HTTP 상태는 사용자 제공 실행 결과 기준이며 서버 로그로 독립 재수집한 기록은 아님.
- **이후 B 로그인 상태의 동일 HTTP 검증도 PowerShell로 완료: A↔B 총 18/18 PASS.**
- 로그인 200 → 전역 로그아웃 204 → 재로그인 200. 이전 access token 동일 GET 재사용 401(PowerShell 실측). 비밀번호 변경 이전 access token은 RLS 강화 후 404(7/7 PASS).
- 로그인 요청 헤더/주소에서 비밀번호 원문 없음. 로그인 요청 본문에는 비밀번호가 전달될 수 있으며, 제출 자료에는 절대 포함하지 않음.

## ⑤ AI와 나
- AI에게 맡긴 일: Supabase·GitHub·Vercel 소스/DB/배포 점검, RLS/HTTP 검증 경로 구현, 증빙·집계 정리.
- 내가 직접 판단한 일: 연구 주제·운동 내용·예상 및 실제 시간·계획 규칙 변경, 실제 로그인/로그아웃/두 계정 확인과 브라우저 검증 실행.
- 따르지 않은 제안: 검증하지 않은 조건을 '통과'로 적지 않고, 기존 계정을 실제 삭제하지 않음.

## ⑥ 아직 못 막은 것과 위험
- C114 로그아웃·비밀번호 변경 뒤 접근 거절은 실측 완료. 실제 60분 경과 후 자연 만료 시험, 로그인 요청/응답/로그 원문 미노출 전수검사는 별도.
- B→A HTTP 읽기·수정·삭제 404 및 헤더/URL 위조 404는 실측 완료. **요청 본문 user_id 위조도 최신 전용 검증 페이지에 추가했으나 실행 결과는 별도 확보 필요.**
- 무차별 로그인 시도 방어의 별도 실험, 비밀번호 초기화, 두 번째 인증 수단은 미검증. 계정 탈취에 취약할 수 있음.
- 과제 평가 기준 C121의 403/404는 전용 `/api/secure-plan`에서 확인됨. 기존 Supabase REST 전체 API가 403/404를 준다는 뜻은 아님.

## 5일 연구 결과 (2026-10-09 ~ 10-13, Asia/Seoul)
- 질문: **계획한 운동시간과 실제 운동시간의 차이를 줄일 수 있을까?**
- 지표: **운동시간 절대오차**, 단위 분, `ABS(실제 운동시간 - 예상 운동시간)`.
- 예상 90·80·80·80·60분, 실제 90·80·80·60·60분; 절대오차 0·0·0·20·0분.
- 합계: 예상 **390분**, 실제 **370분**, 절대오차 합계 **20분**, 평균 절대오차 **4.00분**. 실사용 SEE 캡처값과 대조 일치.
- 2026-10-10 22:23:33(KST), 2일차 뒤/3일차 앞에 규칙 1회 변경: 최초 예상 90분 고정 → 다음 운동 예상시간을 직전 실제 운동시간으로 설정하고 운동 전에 확정. 2일차 예상시간은 운동 후 입력한 사실을 인정하며 예측력 증거로 사용하지 않음.
- 결측·중복 실행은 집계에서 제외 후 따로 확인, 이상치는 원본 유지, 평균은 소수 둘째 자리 반올림, 한 주 시작 요일 월요일.
- 사용자가 실제 JSON 파일 다운로드 성공, 8개 테이블 포함 확인. 계정 삭제 안내(복구 불가 및 동반 삭제) 화면 확인, 실제 삭제는 미실행.

## T06 최종 소스 계승 (C77/C78)
- 최종 T06 고정 커밋: `0bf0cc64a3b30283b3c29020e2a667b7f7681f5f`.
- GitHub Actions가 `-s ours --allow-unrelated-histories` 방식으로 T07의 트리 내용을 유지하면서 T06 최종 커밋을 부모로 연결.
- T07 GitHub compare 응답: T06 commit → T07 main 은 **ahead**, `behind_by=0`, merge_base가 T06 고정 커밋과 일치. C78 충족.
- 고정된 최종 T07 커밋 URL은 마지막 소스 수정·배포 검증 후 제출.

## 재현·통과·실패 확인 4줄
1. **어디로:** 공개 Vercel Plan·Do·See Diary 최종 URL.
2. **무엇을:** 시크릿 창에서 로그인 화면 확인 → 계정으로 로그인하여 자기 기록/5일 지표 확인 → 전용 보안 검증 경로에서 본인/타인/비로그인 응답 확인(3단계).
3. **통과:** 비로그인 기록 비노출, 내 운동 5일/390·370·20·4.00분 일치, 보안 검증 화면 401/200/404/404/404.
4. **실패:** 로그인 전 내 기록 표시, 다른 계정 기록 노출, 집계 불일치 또는 차단 응답 오류.


## 2026-10-14 23:16 KST — PowerShell 보안 검증 결과 (실행 증빙)
- 검사 프로그램: `T07_full_security_validation.ps1`; 제출 ZIP에 비밀값 없는 `T07-safe-results.json` 기록.
- **18개 항목 중 18개 PASS.** Gmail/Naver 각각 본인 Plan GET 200, 상대방 GET/PATCH/DELETE 모두 404.
- URL 쿼리 및 `X-User-ID` 헤더 사칭 양방향 404, 비로그인 GET 401, 상호 수정/삭제 시도 전후 계정별 Plan 조회 내용 불변.
- 로그아웃 동일 요청 실측: **동일 URL/메서드(GET), 동일 이전 JWT**로 로그아웃 전 200 → Supabase 전역 로그아웃 204 → 로그아웃 후 401.
- 결과 JSON에 토큰/비밀번호 원문 없음. **비밀번호 변경 후 이전 JWT**, 토큰 실시간 만료, 서버 로그 전수검사는 미실시이므로 별도.

## 민감정보 주의
- 비밀번호 원문, access/refresh token, 쿠키, 서버 서명키 및 service_role 원문을 공개 소스·제출물에 넣지 않음.
- 제출 캡처의 authorization/cookie/session 식별자는 `[REDACTED]`로 가림.

## 2026-10-14 카드 1~5 최종 점검 보완
- 최신 앱 SDK: Supabase JS `2.117.3`으로 버전 고정. 비밀번호 로그인 후 숨김 DOM 입력값 초기화.
- 저장 해시 형식 bcrypt `$2a$10$`, 60자, 동일 비밀번호 두 계정 다른 해시 확인. **전체 해시 값은 오프라인/비공개 제출 증빙에만 기록하고 공개 Git에는 미포함.**
- 2026-10-14 23:36 KST 실제 C114 재검증: 변경 전 기존 JWT 본인 GET 200, 비밀번호 변경 후 동일 JWT 404, 원래 비밀번호 복원/로그인 200, 총 7/7 PASS.
- HTTP GET/PATCH/DELETE 상호 차단 및 전후 데이터 불변, 비로그인, 헤더/URL 위조: PowerShell 18/18 PASS.
- 요청 본문 소유자 사칭 PATCH 검증은 `t07-security-check.html`에 추가해 실행 증빙 대기.
- 로그 쿼리(보유 데이터 범위): auth_audit 23, auth 52, edge 128, postgrest 28의 총 231건 중 비밀번호 JSON 값/서버 secret 키 패턴 탐지 0건(패턴 기반 점검이지 전수 부재 보장은 아님).
- GitHub 공개 코드 및 Git commit 18개 변경 패치에 대한 토큰·service_role·secret 관련 패턴 검사: 의심 일치 0건(검사 패턴 범위 내).
- 별도 `pds_diary` 1건이 익명 조회되는 과거 정책 발견, restrictive SELECT RLS 추가 후 anon 조회 0건 확인.
- 최종 고정 Git SHA는 마지막 파일 수정 및 Vercel READY 확인 후 제출해야 한다.
