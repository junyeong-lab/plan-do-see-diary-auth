# SKT ALEPH T07 — 카드 1~5 최종 보안 검증

작성 기준: 2026-10-15. 테스트의 통과는 **명시된 과제 및 검사 범위**에 대한 판정이며 모든 시스템·모든 시간의 비밀정보 부재를 수학적으로 증명한다는 뜻은 아닙니다.

## C113 — 서버 전용 비밀값의 브라우저 소스 노출 방지

**판정: 확인.**

- Vercel 공개 배포에서 사용자가 추출한 `index.html` 481줄과 GitHub의 현재 소스/보안 API를 확인했습니다.
- 브라우저 소스의 유일한 Supabase 키는 `sb_publishable_`으로 시작하는 **공개용 publishable key**입니다.
- 브라우저 코드/공개 Git 이력에서 서버 `service_role` 키, `sb_secret_` 값, JWT 서명 비밀값, 실제 Bearer JWT 및 비밀번호 해시 원문이 검출되지 않았습니다.
- 인증은 Supabase Auth에 위임하고 DB 소유권 제한은 RLS로 수행합니다. 비밀키를 프런트엔드에 넣어 동작시키지 않습니다.

## C46 — 공개 코드·제출 자료의 비밀값 누출 방지

**판정: 확인 (아래 범위).**

**자동화된 전체 Git 이력 스캔:**
- 소스: `tools/t07_secret_audit.py`
- 지속 검증: `.github/workflows/t07-public-secret-audit.yml` (main push 또는 수동 실행)
- GitHub Actions 최초 성공: https://github.com/junyeong-lab/plan-do-see-diary-auth/actions/runs/38666641793
- 검사 결과: 접근 가능한 Git 객체 **110개** 중 고유 Blob **30개**, 총 **441,311바이트**를 검사해 **비밀값 패턴 발견 0건**, 작업 결과 **success**.
- 점검 대상은 전체 Git 이력에서 접근 가능한 모든 Blob으로, 최신 커밋 소스만 검사하는 것보다 넓습니다. 누출된 원문을 로그에 출력하지 않습니다.

**공개 증빙 ZIP 검사:**
- `SKT_ALEPH_T07_BUILD_LOGS_VERIFIED_PUBLIC.zip`: 총 22개 파일 중 텍스트/JSON/CSV/SQL/PDF 등 검색 가능한 **18개 파일** 검사.
- 서버 비밀키, JWT 원문, PEM 개인키, 전체 bcrypt 저장 해시 및 비밀키 할당 패턴 **0건**.
- ZIP 무결성 정상; SHA-256: `67490fc0821baa1560d763069ab9eea8ec6f5fcbb9feab7b949b2828cf2cf8d2`.
- **실제 bcrypt 해시와 계정별 원본 데이터가 담긴 비공개 증빙 ZIP은 공개 제출하지 않습니다.**

**Vercel 배포 확인:**
- 사용자 계정으로 최신 Production 배포의 **Deploy Logs** 직접 열람:
  - `Cloning ... (Branch: main, Commit: 6b30763)`
  - `Build Completed`, `Deployment completed`
  - 빌드 로그에 비밀번호·JWT·서버키 원문이 출력된 항목 없음.
  - ESM → CommonJS 변환 경고는 빌드 성공과 함께 표시되는 비밀정보와 무관한 메시지입니다.
- 같은 배포의 Runtime Logs 화면은 해당 조회 기간에 `There are no runtime logs in this time range` 표시. **이 화면만으로 모든 과거 로그의 부재를 증명하지 않습니다.**
- 공개된 `api/secure-plan.js`에는 비밀번호·JWT를 출력하는 `console.log` 구문이 없고, 서버의 보호 API는 검증에서 본인 GET 200, 타인 GET/PATCH/DELETE 404, 비로그인 401을 반환합니다.
- Vercel API로 내부 로그를 직접 조회하려는 도구는 계정 범위 제한(403)을 받았으나, 사용자가 로그인한 대시보드에서 최신 빌드와 런타임 조회 화면을 제공했습니다.

## 권한·세션·데이터 보존 교차검증

- A↔B 양방향 HTTP 소유권 테스트 **18/18 PASS**, 데이터 불변.
- 비밀번호 변경 후 이전 JWT 차단 및 비밀번호 복원 **7/7 PASS**.
- 추가 실제 로컬 HTTP 시험 **22/22 PASS**: 비밀번호 원문이 반환 응답에 없음, URL/헤더/본문 동시 소유자 사칭 PATCH 404, 임시 Plan 생성 201→조회 200→수정 204→삭제 204→재조회 404. 기존 Plan은 불변, 임시 Plan도 정리.
- 8개 업무 테이블 RLS에 `auth.uid()=user_id` 및 변경 전 JWT 차단 조건 적용.
- 사용자 SQL 실행 이후 내부 트리거 `t07_capture_password_change()`에 대한 `anon` / `authenticated` 직접 EXECUTE 권한이 모두 **false**로 재조회 확인.
- T06 최종 Git 커밋 `0bf0cc64a3b30283b3c29020e2a667b7f7681f5f`이 T07의 Git 조상으로 남아 있습니다.

## 5일 운동 연구

2026-10-09~13, 예상 **390분**, 실제 **370분**, 절대오차 합계 **20분**, 평균 절대오차 **4.00분**. 규칙 1회 변경(2일차 뒤·3일차 앞). JSON 내보내기 및 SEE 화면 증빙과 일치.

## 제출 시 주의

- 평가 제출란이 요구하는 것은 공개 Vercel 결과물 URL과 **정확한 최종 40자리 GitHub 커밋 URL 각 1개**입니다.
- 증빙 ZIP/PDF는 별도 요청받은 경우에만 제출하고, 비공개 원본·해시·토큰·암호를 공개하지 않습니다.
- 공개된 `sb_publishable_` 키는 비밀키가 아닙니다. 로그인 요청 **본문**에는 인증에 필요한 비밀번호가 전달되며, 인증 요청의 비밀정보를 외부 제출 자료에 노출하지 않는 것이 검증 목표입니다.
