# 디자인 변경 · 2026-09-16

## 현재 적용된 디자인

- 사람 형상과 중앙의 네모난 이미지 카드를 제거했다.
- 황금빛 보름달, 별이 가득한 짙은 남색 하늘, 아래쪽 구름이 화면 전체 배경이다.
- 배경 중앙 기준 왼쪽은 세로 유리 굴절, 오른쪽은 빈티지 필름 입자와 노이즈다. 달도 같은 질감으로 반반 나뉜다.
- 배경은 콘텐츠와 별개로 화면에 고정된다. 가로 화면에서도 달이 잘리지 않도록 위쪽에 맞춰 확대하고 수평 중앙을 유지한다.
- 홈·온보딩·대기·수신에는 달을 볼 수 있는 여백을 둔다. 폼·기록·프로필·대화 화면은 가독성을 위해 배경을 더 어둡게 한다.
- MOONLINE은 로즈핑크 대문자이며, 앞에서 뒤로 갈수록 200→800 굵기로 변한다. 세미콜론 없음. 시스템 산세리프를 사용하므로 OS별 굵기 표현에는 차이가 있을 수 있다.
- 기존 데이터, 로컬 저장 키, 예약·통화 상태 처리에는 변경 없음.

## 구현 및 자산

- `src/components/Glass.tsx`: 전체 배경 NightBackdrop, 배경 달을 위한 여백 MoonSpace, 반투명 GlassSurface.
- `src/components/Wordmark.tsx`: 글자별 굵기가 달라지는 워드마크.
- `assets/moon-night-background.png`: 현재 배경. 내장 image_gen으로 제작.
- `thermal-presence.png`, ThermalPresence, FilmPoster와 과거 필름 이미지는 이전 디자인 자료이며 현재 화면에 배치하지 않는다.
- Android는 기존 `experimentalBlurMethod="none"` 설정을 유지한다. 생성 이미지의 유리 질감과 반투명 패널은 적용되며 Android 실시간 블러를 실기기로 검증한 것은 아니다.

## 검증

- `npm run typecheck` 및 앱 테스트 16개 통과.
- 브라우저의 데스크톱·390×844 모바일 홈 화면에서 배경과 조작 버튼 확인.
- 390px 문서 폭에 가로 넘침 없음. 작성 화면의 입력창·선택 상태·하단 고정 버튼 가독성 확인.
- 실기기 검증은 별도다.

## 내장 image_gen 최종 생성 프롬프트

참고 이미지: 사용자가 제공한 황금빛 달과 별·구름 사진. 참고 원본 파일은 저장소에 복사하지 않았다.

[배경 이미지](../assets/moon-night-background.png)

```text
Create a full-bleed nighttime background artwork for the Moonline app, based closely on the supplied mood reference: a large warm golden full moon, rich deep navy black sky filled with fine stars, soft vintage cream-grey clouds drifting across the bottom. No people. NO rectangular card, poster frame, UI or text. Compose as a WIDE 3:2 landscape image which will also be center-cropped for tall phone screens: keep the SINGLE full moon horizontally centered at x=50%, center at y=24% of image height, moon diameter about 18% of total image width. The central narrow vertical third of the image must retain a beautiful full moon, stars and a little cloud near the bottom; outer sides extend with starfield. The moon's complete circular disk must remain inside the image. Recognizable crater texture and a muted honey-gold surface, nostalgic magical yet quiet, like an old printed astronomy photograph, NOT a neon or sci-fi planet. Apply a precise 50/50 surface treatment divided vertically at the exact CENTER of the entire image, passing through the center of the moon: LEFT HALF is behind dimensional vertically fluted glass with broad translucent ribs and visible subtle horizontal optical refraction of the moon and stars, alternating soft highlights and dark grooves, unmistakable glassmorphism. RIGHT HALF is free of glass ribs, has matte vintage analog film grain, subtle organic noise and fine dust, restrained faded color, visible moon craters. Both halves are ONE continuous sky and ONE aligned moon, not two scenes or duplicated moons. Keep both halves equally dark and calm. Stars delicate, a fine milky way texture lower in the sky, no colored galaxy or excessive nebula. Clouds at lower edge should not become bright white masses; preserve dark mid-lower center space where app text will overlay. No lettering, branding, watermarks, borders or panels. Render detailed grain and realistic optical glass. Warm gold moon against midnight navy is the main palette.
```
