# 마이라이프

경제, 일기·메모, 독서, 공부, 취미, 건강, 계획을 한곳에서 기록하는 개인용 웹앱입니다.
모든 구성 요소를 무료 요금제로만 사용합니다.

## 지금 바로 써 보기 (체험 모드)

```
npm run dev
```

터미널에 나오는 주소(보통 http://localhost:5173)를 브라우저에서 엽니다.
아래 설정을 하기 전에는 **체험 모드**로 동작하며, 기록이 그 브라우저에만 저장됩니다.
체험 모드에서 적은 기록은 설정 > 백업에서 내보낸 뒤, 클라우드 연결 후 가져올 수 있습니다.

## 폰과 PC에서 함께 쓰기 위한 설정

순서대로 한 번만 하면 됩니다. 전체 30분 정도 걸립니다.

### 1. Supabase (데이터 저장소) — 약 5분

1. https://supabase.com 에서 가입하고 **New project** 를 만듭니다. Region은 `Northeast Asia (Seoul)` 을 고릅니다.
2. 왼쪽 메뉴 **SQL Editor** 를 열고, 이 폴더의 `supabase/schema.sql` 내용을 전부 붙여 넣은 뒤 **Run** 을 누릅니다.
3. **Project Settings > API** 에서 다음 두 값을 복사해 둡니다.
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` `public` 키
4. 이 폴더의 `.env.example` 을 `.env` 로 복사하고 두 값을 넣습니다.

### 2. 구글 로그인과 캘린더 — 약 10분

1. https://console.cloud.google.com 에서 새 프로젝트를 만듭니다.
2. **API 및 서비스 > 라이브러리** 에서 `Google Calendar API` 를 찾아 **사용** 을 누릅니다.
3. **OAuth 동의 화면** 을 만듭니다.
   - 사용자 유형: 외부
   - 범위 추가: `.../auth/calendar.events`
   - 테스트 사용자: 본인 구글 이메일 추가 (게시하지 않고 테스트 상태로 둡니다. 그러면 본인만 로그인할 수 있습니다.)
4. **사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**
   - 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI: `https://xxxx.supabase.co/auth/v1/callback` (xxxx는 1번의 Project URL과 같게)
   - 만들어진 **클라이언트 ID** 와 **클라이언트 보안 비밀번호** 를 복사합니다.
5. Supabase로 돌아가 **Authentication > Providers > Google** 을 켜고 위 두 값을 붙여 넣습니다.
6. Supabase **Authentication > URL Configuration**
   - Site URL: `https://jaehe-he.github.io/my-life-log/`
   - Redirect URLs 에 `http://localhost:5173/` 과 위 주소를 모두 추가

이제 `npm run dev` 로 열면 구글 로그인 화면이 나옵니다.

### 3. GitHub Pages 배포 — 약 5분

1. GitHub에 `my-life-log` 저장소를 만들고 이 폴더를 올립니다. (Claude에게 "배포해줘"라고 하면 대신 해 줍니다.)
2. 저장소 **Settings > Secrets and variables > Actions** 에 두 값을 등록합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 저장소 **Settings > Pages > Source** 를 `GitHub Actions` 로 바꿉니다.
4. 이후 `main` 에 올릴 때마다 자동으로 배포됩니다. 주소는 `https://jaehe-he.github.io/my-life-log/` 입니다.

`.github/workflows/keepalive.yml` 이 매일 한 번 Supabase에 접속해서, 7일 미접속 시 걸리는 일시 정지를 막아 줍니다.

### 4. 네이버 책 검색 — 약 5분 (하지 않으면 구글 도서 검색으로 동작)

1. https://developers.naver.com/apps 에서 애플리케이션을 등록합니다. 사용 API는 **검색**, 환경은 **WEB 설정**(주소는 배포 주소)입니다.
2. 발급된 Client ID와 Client Secret을 Supabase **Edge Functions > Secrets** 에 등록합니다.
   - `NAVER_CLIENT_ID`
   - `NAVER_CLIENT_SECRET`
3. Supabase **Edge Functions > Deploy a new function > Via Editor** 에서 이름을 `book-search` 로 하고, `supabase/functions/book-search/index.ts` 내용을 붙여 넣어 배포합니다.

네이버는 쪽수를 알려 주지 않아서, 쪽수만 구글 도서 정보에서 자동으로 찾아 채웁니다. 찾지 못하면 직접 적습니다.

### 5. 폰에 설치

- 안드로이드(Chrome): 배포 주소를 열고 메뉴 > **홈 화면에 추가**
- 아이폰(Safari): 공유 버튼 > **홈 화면에 추가**

## 알아둘 점

- **구글 캘린더 연결은 약 1시간마다 만료됩니다.** 만료되면 계획 > 캘린더에 "구글 다시 연결" 버튼이 나옵니다. 그 사이 앱에 적은 일정은 앱에 저장되어 있고, 다시 연결한 뒤 "지금 보내기"로 구글에 보낼 수 있습니다.
- 구글 캘린더에서 직접 만든 일정은 앱 달력에 함께 보이지만, 고치는 것은 구글 캘린더에서 합니다.
- 투자 평가액은 직접 고쳐 적습니다. 시세를 자동으로 가져오지 않습니다.
- 사진은 약 200KB로 줄여서 올립니다. 무료 저장 공간은 1GB이고, 사용량은 설정 > 계정에서 볼 수 있습니다.
- 설정 > 백업에서 모든 기록을 파일로 내려받을 수 있습니다. 가끔 받아 두면 안전합니다.

## 폴더 구조

| 위치 | 내용 |
| --- | --- |
| `src/pages/` | 메뉴별 화면 (홈, 경제, 일기·메모, 독서, 공부, 취미, 건강, 계획, 리포트, 설정) |
| `src/lib/db.ts` | 데이터 저장 (Supabase 또는 체험 모드) |
| `src/lib/forms.ts` | 여러 화면에서 함께 쓰는 입력 항목 |
| `src/components/` | 입력 창, 카드, 달력, 그래프 |
| `supabase/schema.sql` | 데이터베이스 표와 잠금 규칙 |
| `supabase/functions/book-search/` | 네이버 책 검색 함수 |
| `docs/blueprint.html` | 구성도 |
