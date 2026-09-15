# 이미지 및 글꼴

- 파일: `assets/waiting-film.png`
- 제작: 내장 image_gen 도구, 새 이미지 생성 모드. 코드로 사진을 합성하거나 기존 포스터를 수정하지 않았습니다.
- 용도: 홈과 예약 대기 화면의 필름 포스터 배경.

## 생성 프롬프트 요지

Original photorealistic vertical 35mm film still, late-1990s Taiwanese coastal apartment, sage rotary phone on a honey wood table beside an open mint shutter, cream envelope with no readable text, white curtain, olive foliage and amber sunlight. Warm nostalgic anticipation of a phone call. Muted greens, cream and peach, subtle film grain and halation. Phone in the lower middle, room for handwritten title overlay. No text, UI, logos, neon or purple.

## 글꼴

손글씨/명조 글꼴과 해당 패키지를 제거했습니다. 현재 iOS System, Android sans-serif, 웹 OS 산세리프를 사용합니다. 로고와 제목은 가벼운 굵기, 본문과 버튼은 선명한 굵기로 구분합니다. 별도 글꼴 다운로드 없이 표시합니다.

## 2026-09-16 현재 메인 비주얼

- `assets/thermal-presence.png`: 긴 머리의 중성적인 옆모습. 왼쪽은 세로 유리 굴절, 오른쪽은 빈티지 필름 노이즈.
- 내장 image_gen으로 제작. [최종 생성 프롬프트와 적용 범위](DESIGN-UPDATE-2026-09-16.md).
- 기존 `waiting-film.png`는 이전 디자인 자료로 보존하며, 현재 홈·대기 화면은 새 인물 비주얼을 사용한다.
- 현재 워드마크는 `src/components/Wordmark.tsx`의 시스템 산세리프 텍스트다. MOONLINE이 앞에서 뒤로 점차 굵어지며 세미콜론은 사용하지 않는다.

## 최신 변경: 달과 별의 전체 배경

현재 화면은 `assets/moon-night-background.png`를 전체 배경으로 사용한다. 왼쪽은 세로 유리, 오른쪽은 빈티지 노이즈다. 인물과 중앙 이미지 카드는 제거했다. 위의 인물·필름 설명은 이전 디자인 이력이다. 내장 image_gen의 [현재 생성 프롬프트](DESIGN-UPDATE-2026-09-16.md)를 참고한다.
