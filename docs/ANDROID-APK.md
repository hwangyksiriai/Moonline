# Moonline Android 설치 파일

GitHub Actions의 **Build Android APK** 워크플로를 수동 실행하면 Expo Go와 개발 서버 없이 실행되는 release APK를 만든다. JS 번들과 이미지가 APK에 들어가며 기본 체험 데이터는 설치한 기기에 저장한다. 실제 AI·전화·음성 복제 공급자 계정은 연결하지 않는다.

## 빌드

- Node.js 24, Java 17, GitHub Ubuntu Android SDK로 빌드한다.
- `expo prebuild --platform android --no-install` 후 `:app:assembleRelease`를 실행한다.
- ARM64와 ARMv7 안드로이드 기기를 대상으로 하며 iPhone에서는 설치할 수 없다.
- Expo Android 템플릿에 포함된 기본 테스트 키로 서명한다. 별도 개인 키·비밀번호를 생성하거나 GitHub secrets에 전송하지 않는다. 스토어 출시용 서명이 아니며 실제 서비스 출시 전 전용 키를 별도 준비해야 한다.
- 업데이트 설치에는 같은 서명 키와 더 큰 versionCode가 필요하다. versionCode는 workflow run number로 증가한다.
- workflow artifact에 APK, SHA-256과 패키지 정보가 생성된다. 공개 다운로드는 검증된 artifact를 GitHub Release에 첨부한다.

## 사용

APK를 휴대폰으로 받아 연 뒤 해당 다운로드 앱의 ‘출처를 알 수 없는 앱 설치’를 허용하고 설치한다. 예약 체험은 앱을 열어둔 상태에서 확인한다. 소리는 기기에 설치된 한국어 TTS를 사용하며 녹음/알림 기능은 사용할 때 권한을 요청한다.

컴파일·서명 검증과 실제 기기 실행 검증은 다르다. 실제 기기 검증 여부는 릴리스 설명에 기록한다.
