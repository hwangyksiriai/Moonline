import { memoryLines, topicChange, wantsToEnd } from "../../shared/memory.ts";
import type { Call, Message } from "../../shared/model.ts";
import { scenarioOf } from "../../shared/catalog.ts";
export function opening(call: Call, name: string, memory?: string) {
  const base = (
    call.greeting || scenarioOf(call.scenarioId).opening
  ).replaceAll("{이름}", call.userNickname || name);
  name = call.userNickname || name;
  const fact = memoryLines(memory)[0];
  return fact
    ? `${base} 지난번에 “${fact}”라고 했었지. 오늘 그 이야기를 다시 꺼내도 괜찮아?`
    : base;
}
export function mockReply(
  text: string,
  call: Call,
  messages: Message[],
): string {
  // The caller passes the newly submitted user message too. Context below is
  // strictly from earlier turns, so the current question cannot recall itself.
  const history = messages.at(-1)?.speaker === "you" && messages.at(-1)?.text.trim() === text.trim()
    ? messages.slice(0, -1) : messages;
  const lastCaller = history.filter((m) => m.speaker === "caller").at(-1)?.text ?? "";
  const used = new Set(history.filter((m) => m.speaker === "caller").map((m) => m.text));
  const input = text.trim().replace(/\s+/g, " ");
  const pick = (choices: string[]) => choices.find((choice) => !used.has(choice))
    ?? "이 마음에 답할 수 있는 체험 문장은 여기까지 준비돼 있어. 같은 말만 반복하지 않을게. 다른 이야기를 골라볼까?";
  const nickname = call.userNickname ? `${call.userNickname}, ` : "";
  if (wantsToEnd(text))
    return "응, 오늘은 여기까지 이야기하자. 편안한 밤 보내.";
  if (topicChange(text))
    return pick([
      "알겠어. 그 이야기는 여기서 멈출게. 음악 이야기와 오늘 먹은 음식 중 어떤 게 좋을까?",
      "응, 그 얘기는 멈출게. 이번에는 네가 하고 싶은 이야기를 골라줘.",
    ]);
  if (/같은\s*말|반복|말귀|대화.*안|동문서답|왜.*(답|대답)/.test(input))
    return "네 말에 맞지 않는 답을 했구나. 미안해. 지금은 AI가 연결되지 않은 체험 대화라 이해할 수 있는 말에 한계가 있어. 어떤 말을 놓쳤는지 짧게 다시 알려줄래?";
  if (/내가.*(했지|말했|기억)|기억.*나/.test(input)) {
    const boundary = history.findLastIndex((m) => m.speaker === "you" && topicChange(m.text));
    const earlier = history
      .slice(boundary + 1)
      .filter(
        (m) =>
          m.speaker === "you" && !/[?？]$/.test(m.text) && !/내가.*(했지|말했|기억)/.test(m.text),
      )
      .at(-1);
    return earlier
      ? "아까 “" + earlier.text + "”라고 말해줬어. 내가 놓친 부분이 있을까?"
      : "지금 이어가고 있는 주제에서 아직 들은 이야기가 없어. 멈추기로 한 이야기는 다시 꺼내지 않을게.";
  }
  if (/너.*누구|누구야|누구세요|이름.*뭐|이름.*알려/.test(input))
    return call.scenarioId === "future"
      ? "나야. 10년 뒤의 너라는 상상을 해봤어. 지금의 너에게 꼭 전화하고 싶었거든."
      : `나는 ${call.characterName || call.voice}이야. 네가 정한 ‘${call.relationship || "친구"}’ 역할로 이야기하고 있어.`;
  if (/AI|인공지능|진짜\s*사람|사람이야|로봇/i.test(input))
    return "지금은 AI가 연결되지 않은 체험 캐릭터야. 준비된 문장으로 답하고 기기의 목소리로 읽어주고 있어.";
  if (/뭐\s*해|뭐\s*하고|뭐하고있/.test(input))
    return pick(["지금은 너랑 이야기하고 있지. 넌 지금 뭐 하고 있어?", "네 다음 이야기를 기다리고 있었어. 지금 어디에서 전화받고 있어?"]);
  if (/안\s*(고마|감사)|고맙지\s*않/.test(input))
    return "내 말이 도움이 되지 않았구나. 어떤 부분이 네 마음과 달랐어?";
  if (/(너|네가|니가|너를).*보고\s*싶/.test(input) ||
      (/누가 가장 보고 싶어/.test(lastCaller) && /^(너|너야|너지|네가|니가|너라고|너를)[.!~ ]*$/.test(input)))
    return pick(call.relationship === "연인" || call.scenarioId === "love"
      ? ["내가 보고 싶었던 거구나. 그렇게 말해줘서 마음이 따뜻해져. 지금 함께라면 무엇을 하고 싶어?", "함께 있고 싶은 마음이 전해져. 여기서 조금 더 이야기 나누자."]
      : ["내가 생각났구나. 말해줘서 고마워. 여기서 조금 더 이야기 나누자. 오늘 무슨 일이 있었어?", "다시 찾아줘서 반가워. 오늘 나에게 들려주고 싶은 이야기가 있어?"]);
  if (/(엄마|아빠|가족|친구|할머니|할아버지|동생|언니|형|오빠|누나).*보고\s*싶/.test(input))
    return pick(["소중한 사람이 많이 그립구나. 그 사람과 어떤 순간이 가장 기억나?", "그리움이 쉽게 가시지 않지. 그 사람에게 지금 전하고 싶은 말을 들려줄래?"]);
  if (/보고\s*싶|그리워|그립|외로|외롭|쓸쓸/.test(input))
    return pick([
      `${nickname}누군가 곁에 있었으면 하는 순간이지. 지금 누가 가장 보고 싶어?`,
      "그리운 마음이 아직 남아 있구나. 그 사람과 어떤 순간을 함께하고 싶어?",
      "지금 당장 만나지 못해서 더 아쉽겠다. 전하고 싶은 말을 여기서 먼저 해볼래?",
    ]);
  if (/고마|고맙|감사/.test(input))
    return pick([
      `${nickname}그렇게 말해줘서 나도 고마워. 조금이라도 마음이 편해졌다면 좋겠다.`,
      "마음이 전해졌어. 더 하고 싶은 말이 있으면 편하게 해줘.",
      "응, 네 마음 잘 받았어. 잠깐 쉬었다가 이야기해도 괜찮아.",
    ]);
  if (/안\s*힘들|힘들지\s*않|안\s*슬퍼|걱정\s*없/.test(input))
    return "그렇구나, 힘든 하루라고 짐작할 필요는 없었네. 오늘은 어떤 기분이야?";
  if (/기뻐|기쁘|행복|신나|합격|좋은\s*일|잘\s*마쳤|칭찬\s*받/.test(input))
    return pick(["좋은 일이 있었구나! 어떤 순간이 가장 기뻤어?", "그 기분 오래 간직하고 싶겠다. 어떻게 축하하고 싶어?"]);
  if (/걱정|불안|힘들|지쳤|지치|속상|우울|슬퍼|슬프|스트레스|화가\s*나/.test(input)) {
    let answer = pick([
      "마음이 많이 무거웠구나. 조언이 필요해, 아니면 그냥 들어줬으면 좋겠어?",
      "아직 마음에 걸리는 게 있구나. 지금 가장 버거운 부분 하나만 말해줄래?",
      "당장 괜찮아지려고 애쓰지 않아도 돼. 잠깐 쉬는 것부터 해볼까?",
    ]);
    if (call.mustSayPhrase && !history.some((m) => m.speaker === "caller" && m.text.includes(call.mustSayPhrase!)))
      answer += ` ${call.mustSayPhrase}`;
    return answer;
  }
  if (/들어\s*줘|듣기만|조언.*(말|싫)|위로.*해/.test(input))
    return pick(["응, 해결책부터 말하지 않을게. 하고 싶은 이야기부터 들려줘.", "알겠어. 지금은 네 이야기를 듣는 데 집중할게."]);
  if (/조언|어떻게\s*하|어떡|도와/.test(input))
    return pick(["함께 생각해보자. 지금 바꾸고 싶은 상황 하나를 알려줄래?", "당장 할 수 있는 작은 일부터 골라보면 어떨까? 쉬기, 정리하기, 누군가에게 도움 요청하기 중 뭐가 가능해?"]);
  if (/미안|잘못했/.test(input))
    return pick(["어떤 일이 마음에 걸렸어? 먼저 이야기를 들어보고 싶어.", "미안하다는 말에 마음이 담겨 있네. 상대에게 가장 전하고 싶은 건 뭐야?"]);
  if (/사랑해|좋아해/.test(input) && !/음악|노래|음식|영화/.test(input))
    return pick(["다정한 말이네. 그렇게 마음을 표현해줘서 고마워.", "네 마음 잘 들었어. 오늘은 어떤 이야기를 함께 나누고 싶어?"]);
  if (/잠이?\s*안\s*와|못\s*자|졸려|잠들|자고\s*싶/.test(input))
    return pick(["잠들기 전에는 작은 생각도 크게 들리지. 머릿속이 복잡해, 아니면 그냥 잠이 안 오는 거야?", "조명을 조금 낮추고 편하게 기대봐. 오늘 이야기는 천천히 마무리해도 괜찮아."]);
  if (/생일/.test(input))
    return pick(["생일 이야기구나. 누구의 생일이야?", "그날을 어떻게 보내고 싶어? 소박한 계획이어도 좋아."]);
  if (/누구의 생일이야/.test(lastCaller))
    return "그 사람에게 어떤 하루가 됐으면 좋겠어? 네 생일이라면 받고 싶은 축하를 말해줘도 좋아.";
  if (/회사|출근|퇴근|업무|야근|직장|상사/.test(input))
    return pick(["회사에서 있었던 이야기구나. 오늘은 일이 잘 풀렸어, 아니면 버거웠어?", "업무 때문이었어, 아니면 함께 일하는 사람 때문이었어?"]);
  if (/잔잔|신나/.test(input) && /노래|음악/.test(lastCaller))
    return "그 분위기로 쉬어가고 싶은 거구나. 노래에서 멜로디와 가사 중 어느 쪽을 더 듣는 편이야?";
  if (/멜로디와 가사/.test(lastCaller) && /멜로디|가사/.test(input))
    return "그 부분에 마음이 가는구나. 특별히 떠오르는 노래가 있으면 제목을 알려줘.";
  if (/음악|노래/.test(input))
    return pick(["요즘 자주 듣는 노래가 있어? 제목이나 좋아하는 분위기를 알려줘.", "잔잔한 노래와 신나는 노래 중 지금은 어떤 쪽이 좋아?"]);
  if (/음식|먹|밥|메뉴/.test(input))
    return pick(["먹는 이야기 좋다. 오늘 맛있게 먹은 게 있어?", "다음에는 어떤 음식을 먹고 싶어?"]);
  // Short answers inherit the last question, but explicit user intents above
  // always win. A topic change therefore cannot drag an old subject back in.
  if (call.scenarioId === "horror" && /들려드릴까요|뒷이야기|계속.*들/.test(lastCaller) &&
      /^(응|네|어|그래|좋아|들려줘|계속|계속해|더 들려줘)[.!~ ]*$/.test(input))
    return pick([
      "오래된 우체통에 날짜 대신 작은 달이 그려진 편지가 도착했대. 받는 사람 이름은 비어 있었고. 뒷이야기도 들을래?",
      "편지를 펼치자 ‘창문 아래를 보세요’라는 문장이 있었어. 아래에는 작은 화분 하나가 놓여 있었지. 계속 들을래?",
      "화분 밑에는 이웃이 남긴 쪽지가 있었대. ‘어젯밤 화분이 떨어질 뻔해서 옮겨뒀어요.’ 수상한 편지는 서툰 이웃의 인사였던 거야. 이야기는 여기까지야.",
    ]);
  if (/누가 가장 보고 싶어/.test(lastCaller))
    return `“${input.slice(0, 60)}” 생각이 났구나. 그 사람과 어떤 순간이 제일 기억나?`;
  if (/제목이나 좋아하는 분위기/.test(lastCaller))
    return `“${input.slice(0, 60)}” 듣는 걸 좋아하는구나. 들으면 어떤 기분이 들어?`;
  if (/잔잔한 노래와 신나는/.test(lastCaller) && /잔잔|신나/.test(input))
    return "그 분위기로 쉬어가고 싶은 거구나. 노래에서 멜로디와 가사 중 어느 쪽을 더 듣는 편이야?";
  if (/오늘 맛있게 먹은/.test(lastCaller))
    return `오늘 음식 이야기는 “${input.slice(0, 60)}”구나. 혼자 먹었어, 아니면 누군가와 같이 먹었어?`;
  if (/^(응|네|어|그래|좋아|좋지|아니|아니야|잘 모르겠어)[.!~ ]*$/.test(input)) {
    if (/들어|이야기/.test(lastCaller))
      return pick(["응, 이어서 듣고 있어. 지금 가장 먼저 떠오르는 이야기를 해줘.", "천천히 말해도 돼. 오늘 있었던 일부터 이야기해볼까?"]);
    return "내가 질문을 너무 넓게 했나 봐. 지금 기분과 오늘 있었던 일 중 어떤 이야기를 하고 싶어?";
  }
  if (/^(안녕|여보세요|하이)[!.?~ ]*$/.test(input))
    return `안녕, ${call.characterName || call.voice}이야. 오늘은 어떤 이야기 하고 싶어?`;
  if (/[?？]|왜|언제|어디|뭐야|뭘까/.test(input))
    return "그 질문에는 준비된 체험 답변이 없어. 아는 척해서 답하고 싶지는 않아. 지금 기분이나 오늘 있었던 이야기를 나눠볼까?";
  return pick([
    "그 말의 뜻을 아직 잘 모르겠어. 어떤 일이 있었는지 조금 더 구체적으로 알려줄래?",
    "내가 제대로 따라가지 못했네. 지금 기분을 한마디로 말해줄래?",
    "이 이야기는 지금 체험 대화로 이어가기 어려워. 음악이나 오늘 먹은 음식 이야기로 바꿔볼까?",
  ]);
}

export function replySuggestions(messages: Message[]): string[] {
  const last = messages.filter((m) => m.speaker === "caller").at(-1)?.text ?? "";
  if (/누가 가장 보고 싶어/.test(last)) return ["네가 보고 싶어", "가족이 보고 싶어"];
  if (/조언이 필요해/.test(last)) return ["그냥 들어줘", "조언을 듣고 싶어"];
  if (/노래와 신나는/.test(last)) return ["잔잔한 노래", "신나는 노래"];
  if (/음악 이야기와|음악이나 오늘/.test(last)) return ["음악 이야기 하자", "오늘 먹은 음식"];
  if (/제목이나 좋아하는 분위기/.test(last)) return ["잔잔한 음악을 좋아해", "신나는 음악을 좋아해"];
  return ["오늘 좀 힘들었어", "좋은 일이 있었어"];
}
