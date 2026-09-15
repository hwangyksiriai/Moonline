# 레퍼런스와 디자인

## 디자인 방향

사용자가 제공한 영화 포스터의 자연광, 낮은 채도, 올리브색, 낡은 종이, 손글씨를 참고했습니다. 포스터 자체를 배경으로 복제하지 않고, 햇살 드는 창가의 전화기 장면을 새로 제작했습니다.

배경 #F3EDDF, 카드 #FAF6ED, 본문 #354137, 올리브 강조 #5B7158. 제목은 나눔명조, 로고는 나눔손글씨 펜, 포스터 영문은 Caveat입니다. 클릭 영역과 폼은 읽기 쉬운 기본 글꼴을 유지합니다.

대기 화면이 핵심입니다. 예약 직후 → 5분 이내 마음의 준비 → 1분 이내 곧 만나는 순간 → 수신으로 이어집니다. 상대가 실제 접속했거나 타이핑한다고 꾸며내지 않습니다. 소리 확인과 기다리기 버튼은 편안한 준비 동작입니다.

## 제품 레퍼런스와 반영

공개 공식 설명/가이드를 조사했습니다. 유료 팬미팅 내부나 각 앱의 실사용 화면 전체를 체험한 것은 아닙니다.

- [hellolive 행사 안내](https://hellolive.tv/detail/789): 차례를 기다리는 구조를 참고했습니다. 현재는 예약 시각 기반 대기입니다. 향후 영상은 권한 설명 → 장치 확인 → 대기 → 입장 허용 → 연결 → 재연결/종료로 확장합니다. `shared/waiting.ts`에 인터페이스를 준비했습니다.
- [Character.AI Creator Guide](https://support.character.ai/hc/en-us/articles/50608794517915-1-Welcome-to-the-Creator-Guide): 캐릭터 이름·목소리·첫 인사를 분리하고, 설정 중 첫 장면을 미리 읽을 수 있게 했습니다.
- [Kindroid memory](https://kindroid.ai/v2/docs/memory/): 직접 입력하는 관계/배경 이야기와 통화에서 얻는 기억을 분리했습니다. 기억은 동의한 동일 캐릭터에 한해 재사용합니다.
- [Replika memory](https://help.replika.com/hc/en-us/articles/37208679176077-How-does-Replika-s-memory-work): 대화 이후에도 이어지는 개인화를 참고했습니다. 현재 저장된 통화 요약을 다음 통화에 전달하는 구조입니다.
- [DearU 공식 소개](https://www.dear-u.co/bbs/board.php?bo_table=pr&wr_id=91): 닉네임·기념일의 개인적인 느낌을 참고했습니다. 첫 인사에 `{이름}`을 넣어 개인화합니다. 실제 아티스트/아이돌 콘텐츠 연동은 없습니다.

## 기술 근거

- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams/websocket-messages)
- [Twilio 요청 보안](https://www.twilio.com/docs/usage/security)
- [OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [Supabase 네이티브 딥링크](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Expo SDK54 알림](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/)

## 2026-09-15 · 따뜻한 글라스모피즘 개편

새 레퍼런스의 세로 결 유리(reeded glass)를 반영했습니다. `Glass.tsx`의 ReededPhoto는 동일 사진을 좁은 띠로 나누어 위치를 다르게 렌더링하고 하이라이트를 겹칩니다. 새 사진 파일로 편집하지 않고 앱에서 효과를 그립니다. 장식은 접근성 트리와 터치 이벤트에서 제외하며, 카운트다운 갱신 때 재렌더링되지 않도록 분리했습니다.

크림·살구·세이지 배경 위에 반투명 패널을 놓고, 이름과 시간은 짙은 유리 패널 위에서 선명하게 유지합니다. 홈·대기 포스터, 공통 카드, 상단/하단 메뉴, 폼과 선택 상태를 함께 변경했습니다.

[Expo SDK54 BlurView 공식 문서](https://docs.expo.dev/versions/v54.0.0/sdk/blur-view/)에 따라 iOS/웹은 실제 배경 블러를 사용합니다. Android에서는 실험적인 블러를 켜지 않고 반투명 색상으로 대체합니다. 세로 사진 굴절 효과는 모든 플랫폼의 공통 렌더링을 사용합니다. 실제 기기 성능과 외관은 추가 확인이 필요합니다.

## 산세리프 및 사용자 관점 검토

손글씨/명조체를 제거하고 시스템 산세리프를 사용합니다. 신규 사용자 흐름과 두 번의 데모 통화를 직접 체험한 상세 평가는 [UX 리뷰](UX-REVIEW-2026-09-15.md)에 별도로 기록했습니다. 리뷰의 개선 제안은 아직 구현하지 않았습니다.
