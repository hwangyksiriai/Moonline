# Moonline · Expo MVP 0.2

예약 → 기다림 → 수신 → 대화 → 기록을 체험하는 모바일 앱입니다. 황금빛 보름달과 별이 화면 전체를 채우고, 왼쪽은 세로 유리 굴절, 오른쪽은 빈티지 필름 질감으로 표현합니다. 중앙의 인물 박스는 제거했고, 앞에서 뒤로 갈수록 굵어지는 로즈핑크 MOONLINE 워드마크를 사용합니다. [디자인 변경](docs/DESIGN-UPDATE-2026-09-16.md)을 참고하세요.

## 집에서 이어서 작업하기

저장소: https://github.com/hwangyksiriai/Moonline

처음 한 번:

```sh
git clone https://github.com/hwangyksiriai/Moonline.git
cd Moonline
npm ci
npm run web
```

기본 데모는 API 키 없이 실행됩니다. GitHub는 코드를 보관하는 곳이며 앱이 자동으로 배포되는 것은 아닙니다.
다른 컴퓨터로 이동하기 전에 변경 내용을 커밋하고 push하고, 작업을 시작할 때 pull합니다. 다른 기기에서 아직 올리지 않은 변경은 내려받을 수 없습니다.

Codex에서 이 폴더를 열고 **“HOME-HANDOFF.md를 읽고 Moonline 작업을 이어서 해줘”**라고 요청하세요.
기존 프로젝트 이름은 밤편지였습니다. docs/ORIGINAL-PLAN.txt는 최초 기획 원문으로 보존했습니다.

## 지금 실행하기

Node.js 24와 npm을 사용합니다. 프로젝트 폴더에서:

```powershell
npm ci
npm start
```

휴대폰과 PC를 같은 Wi-Fi에 연결하고 터미널 QR을 Expo Go로 스캔하세요. Windows에서는 `start-mobile.cmd`로 QR 터미널을 열 수 있습니다. 웹은 `npm run web`입니다. 현재 미리보기는 http://localhost:8081 입니다.

이 프로젝트는 Expo SDK 54입니다. Expo Go와 버전이 맞지 않으면 [공식 버전 안내](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)를 확인하세요. iPhone 실기기 검증은 아직 하지 않았습니다.

## 1분 체험

1. 온보딩 후 사용할 이름을 입력합니다.
2. 추천 전화 또는 나만의 전화 만들기를 선택합니다.
3. 직접 만들기는 이름·관계·성격·첫 인사 → 목소리 → 상황 → 시간 순서입니다. 추천 전화와 재예약은 시간 확인부터 시작합니다.
4. **30초 뒤 · 지금 체험하기**를 선택합니다.
5. 필름 포스터 대기 화면에서 기다렸다가 전화를 받습니다.
6. 답장을 입력하거나 선택하고 통화를 마칩니다. 저장에 동의했다면 기록과 오늘의 한마디를 볼 수 있습니다.

데모는 API 키 없이 동작합니다. 대화는 규칙형 응답이고 소리는 기기의 읽기 음성입니다. 실제 휴대전화망의 전화나 실시간 음성 인식은 데모에서 실행되지 않습니다. 웹에서는 앱을 열어 두세요. 모바일 로컬 알림은 30분 전·5분 전·예약 시각에 예약하지만, OS가 종료된 앱을 통화 화면으로 자동 실행하지는 않습니다.

## 구현 범위

- 3단계 온보딩, 이메일/Google/Apple 로그인 연동 코드, 프로필
- 7가지 상황, 기기에 실제 설치된 한국어 목소리 선택·미리 듣기, 직접 녹음·음성 파일 보관
- 캐릭터 이름·관계·성격·배경 이야기·닉네임·첫 인사·기념일·듣고 싶은 말
- 여러 예약, 날짜/시간 선택, 수정/취소, 카운트다운, 임박한 대기 상태
- 수신/거절/대화/종료, 통화 기록, 한마디 저장, 기억 사용 및 삭제
- 실제 전화용 서버: 소유자 인증, 전화번호 OTP, Twilio 예약 발신, OpenAI Realtime 음성 연결, 통화 요약, 푸시

계정이 준비되지 않아 실제 Twilio/OpenAI/Supabase 연동은 외부 서비스에서 검증하지 않았습니다. 영상통화·실제 아티스트 통화·결제는 구현 범위에 포함하지 않았습니다. 목소리 복제는 ElevenLabs 연결 코드를 추가했지만 계정이 없어 실제 합성은 미검증입니다. [맞춤 목소리 사용과 한계](docs/CUSTOM-VOICE.md)를 참고하세요. 영상통화는 향후 확장 인터페이스만 준비했습니다.

## 서버 데모

모바일 기본 데모는 기기 내부 저장소를 사용하므로 서버 실행이 필요 없습니다. 서버 API를 따로 검증하려면:

```powershell
cd server
npm ci
Copy-Item .env.example .env
npm start
```

기본값은 `DEMO_MODE=true`, `http://127.0.0.1:3001/health`입니다. SQLite 파일은 `server/data/demo.sqlite`에 저장됩니다. `/auth`에서 생성한 데모 토큰은 서버 재시작 시 만료됩니다. 서버 데모는 외부 발신을 하지 않습니다.

## 실제 서비스 연결

1. Supabase 프로젝트에서 이메일 및 필요한 Apple/Google 공급자를 설정합니다. 네이티브 리다이렉트 `moonline://`와 실제 웹 앱 주소를 허용합니다. 공급자 콘솔 설정도 필요합니다.
2. 서버 `.env`에 Supabase DB URL/서버 키, Twilio 번호·계정·Verify 서비스, OpenAI 키, 긴 스트림 서명 비밀키를 넣습니다. `.env.example`의 전체 항목을 참고하세요.
3. 서버에서 `npm run migrate`로 테이블과 카탈로그를 생성합니다. 실제 PostgreSQL 마이그레이션은 미검증 상태입니다.
4. 서버를 HTTPS 및 지속적인 WebSocket을 지원하는 Node 호스트에 배포합니다. `HOST=0.0.0.0`, `DEMO_MODE=false`, `BACKEND_URL`과 `CORS_ORIGINS`를 실제 주소로 설정합니다. 스케줄러가 같은 프로세스에서 돌아가므로 잠들지 않는 호스트가 필요합니다. Dockerfile은 앱 루트를 빌드 컨텍스트로 사용합니다.
5. Twilio가 공개 HTTPS 콜백과 `/voice/stream` WSS에 접근할 수 있어야 합니다. 서버는 콜백 서명과 스트림 토큰을 검증합니다. 프록시는 경로/서명 헤더를 보존해야 합니다.
6. 루트 `.env.example`을 `.env`로 복사하고 `EXPO_PUBLIC_DEMO_MODE=false`, 백엔드 URL, Supabase URL과 공개 anon key만 설정한 뒤 Expo를 재시작합니다. 서비스 역할 키와 Twilio/OpenAI 키를 앱에 넣지 마세요.
7. 앱 로그인 → 마이 → 본인 번호 OTP 인증 → 예약 → 실제 번호 수신 순서로 확인합니다. 서버는 인증된 본인 번호로만 전화합니다. 기본 국가 접두사는 +82입니다.
8. 원격 푸시는 EAS 프로젝트 ID가 설정된 개발 빌드가 필요합니다. Expo Go에서는 지원하지 않습니다. 네이티브 OAuth도 고정된 앱 스킴이 있는 개발 빌드에서 최종 검증하세요.

실제 전화는 Twilio 전화망으로 수신하므로 앱 자체의 마이크/카메라 권한을 요구하지 않습니다. 목소리 미리 듣기의 TTS 모델과 실시간 통화 모델은 달라 음색이 완전히 같지는 않습니다. 실제 발신/통화 요금과 국가별 발신 가능 여부는 계정에서 확인해야 합니다.

## 구조

- `app/`: Expo Router, 앱 진입점
- `src/screens/`: 온보딩, 홈, 생성, 대기/통화, 기록, 마이
- `src/hooks/useNight.ts`: 데모/서버 모드 상태 및 영속 저장
- `src/services/`: 인증, API, 음성, 알림
- `shared/`: 카탈로그, 통화 상태, 대기 상태, 날짜 검증
- `server/src/app.ts`: 인증/예약/기록/OTP API
- `server/src/worker.ts`: 예약 발신, 알림, 요약 작업
- `server/src/realtime.ts`: Twilio ↔ OpenAI 양방향 음성
- `server/src/repository.ts`: SQLite 데모/PostgreSQL 저장소
- `server/migrations/`: 테이블/RLS/인덱스

## 검증

```powershell
npm run typecheck
npm test
npm run export
cd server
npm run typecheck
npm test
```

[검증 기록](QA.md), [레퍼런스와 디자인](docs/REFERENCE-DESIGN.md), [이미지 제작 정보](docs/ASSETS.md)를 참고하세요.

## 출시 전 남은 작업

실제 계정 연동과 실기기 통화/알림/OAuth 테스트, PostgreSQL 실행 검증, 운영 모니터링과 백업, 앱스토어 제출, 비용 한도 운영 검증이 필요합니다. 현재 예약 한도는 API에서 검사하므로 동시 생성 요청의 강한 트랜잭션 한도는 추가 보강 대상입니다. 영상통화와 아티스트 콘텐츠는 별도 영상 인프라 및 정식 권리 확보 후 확장합니다.

## 2026-09-15 UX 개선 반영

[적용 내용과 검증 범위](docs/UX-UPDATE-2026-09-15.md), [맞춤 목소리 도입 방향](docs/CUSTOM-VOICE.md).
초안은 기기에 자동 보관하며 추천 전화·재예약은 시간 확인부터 시작합니다. 통화 중 제어 버튼 고정, 소리 확인, 기억과 원문 분리 관리, 한마디 선택을 추가했습니다.
