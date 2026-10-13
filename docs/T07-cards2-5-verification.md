# T07 카드 2~5 구현 및 검증 (2026-10-13)

## 카드 2: 비밀번호 저장
- Supabase auth.users 저장 형식: bcrypt, `$2a$10$`, 길이 60자.
- 기존 2개 계정의 해시 값은 서로 다름. **동일 비밀번호를 사용했는지 확인되지 않았으므로 C104 통과로 표시하지 않음.**
- 원문 비밀번호, 해시 전체 문자열, JWT를 공개 저장소에 올리지 않음.
- 해시 생성/검증은 Supabase Auth에 위임; 프런트는 `@supabase/supabase-js@2`.

## 카드 3: 세션
- Supabase Auth JWT access token 및 refresh token 방식.
- 소스: `index.html` `signInWithPassword`, `getSession`, `signOut`, `onAuthStateChange`.
- 로그아웃과 기존 access token의 서버 측 즉시 무효화는 동일하지 않음. C109~C114 실제 토큰 재사용/만료 테스트 필요.
- 브라우저 네트워크 요청에서 비밀번호 입력값은 인증 서버로 전송될 수 있음. 제출 캡처는 요청 본문과 인증 헤더를 가려야 함.

## 카드 4: 소유권 보호
- `public.plans`, `plan_history`, `tasks`, `execution_records`, `task_completions`, `reviews`, `t07_study_settings`, `t07_rule_changes`의 RLS: `authenticated` / `ALL` / `USING (auth.uid() = user_id)` / `WITH CHECK (auth.uid() = user_id)`.
- SQL 역할 확인: 비로그인 `t07_study_settings` 조회 0건, 계정 B 역할로 5개 테이블 조회 0건.
- **양방향 HTTP 읽기·수정·삭제 요청의 403/404 증빙은 확보하지 못함.** RLS의 빈 결과는 HTTP 200일 수 있음.

## 카드 5: 연구/내보내기/삭제
- 2026-10-09~13, 5일간 예상 90/80/80/80/60분, 실제 90/80/80/60/60분.
- 절대오차 0/0/0/20/0분, 합계 20분, 평균 4분. 2일차 예측은 운동 후 소급 입력됨.
- 규칙 변경 2026-10-10 22:23:33 KST, Day2 뒤 Day3 기록 전.
- JSON 내보내기 8개 테이블을 사용자 실제 다운로드 파일에서 확인.
- `public.t07_delete_my_account()`: 로그인한 자기 계정의 관련 8개 테이블 데이터와 `auth.users` 레코드 삭제. 익명 실행권한 없음, authenticated만 실행 가능. **실제 삭제 버튼은 데이터 보존을 위해 실행하지 않음.**
- `index.html`에 이중 확인 계정 삭제 UI 반영, Vercel 운영 배포 READY.

## T06 Git 이력 제약
- T06 저장소 최종 커밋: `0bf0cc64a3b30283b3c29020e2a667b7f7681f5f`.
- T07 저장소에서 해당 SHA와 최신 커밋 compare 시 404. **C78 Git 조상 포함 미충족**.
- 임의로 조상 관계를 만들어 냈다고 보고하지 않음.

## 남은 직접 증빙
- 실제 같은 비밀번호로 생성한 테스트 계정 2개 해시 비교 (비밀번호 공유 금지).
- 로그인 요청/응답 캡처(비밀번호/토큰 마스킹), JWT 만료/로그아웃/비밀번호 변경 테스트.
- A/B 계정 모두 자료를 넣고 양방향 HTTP GET/PATCH/DELETE, 403/404, 전후 건수 확인.
- 비로그인 시크릿 창 공개 접근, 앱 화면 합계 대조, 계정 삭제 테스트(별도 폐기용 테스트 계정만).
- T06 고정 커밋을 T07 Git 조상으로 실제 계승하도록 Git 이력 보완.
