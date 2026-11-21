import {
  ClockContext,
  KeyCoord,
  LiveWorldData,
  SentenceAnalysis,
  SyllableAnalysis,
  TheoryId,
  TheoryMeta,
} from '../types/menu';
export { DEFAULT_MENUS } from './menuCatalog';

export const THEORIES: Record<TheoryId, TheoryMeta> = {
  conspiracy: {
    id: 'conspiracy',
    code: '01',
    name: '초성 찾기',
    shortName: '초성 찾기',
    discipline: '숨은 초성',
    scanningText: '문장 속에 그대로 숨어 있는 초성을 찾고 있어요',
  },
  fingerprint: {
    id: 'fingerprint',
    code: '02',
    name: '발음 지문',
    shortName: '발음 지문',
    discipline: '자모 일치율',
    scanningText: '방금 쓰신 자음과 모음이 가장 많이 겹치는 메뉴를 대조하고 있어요',
  },
  clock: {
    id: 'clock',
    code: '03',
    name: '시계 각도',
    shortName: '시계 각도',
    discipline: '시각 회전',
    scanningText: '지금 시각에서 글자 수만큼 시계 바늘을 돌려 보고 있어요',
  },
  weather: {
    id: 'weather',
    code: '04',
    name: '실시간 날씨',
    shortName: '실시간 날씨',
    discipline: '기온·습도',
    scanningText: '지금 바깥의 실시간 기온과 습도를 문장에 맞춰 보고 있어요',
  },
  fx: {
    id: 'fx',
    code: '05',
    name: '실시간 환율',
    shortName: '실시간 환율',
    discipline: '원/달러 시세',
    scanningText: '지금 실시간 원/달러 환율 흐름을 문장에 대입하고 있어요',
  },
  moon: {
    id: 'moon',
    code: '06',
    name: '오늘 달 위상',
    shortName: '오늘 달 위상',
    discipline: '달 밝기',
    scanningText: '오늘 밤하늘 달이 차오른 비율을 계산하고 있어요',
  },
  numerology: {
    id: 'numerology',
    code: '07',
    name: '획수 계산',
    shortName: '획수 계산',
    discipline: '자모 획수',
    scanningText: '글자 획수에 오늘 날짜와 실시간 수치를 맞춰 보고 있어요',
  },
  keyboard: {
    id: 'keyboard',
    code: '08',
    name: '키보드 동선',
    shortName: '키보드 동선',
    discipline: '손가락 무게중심',
    scanningText: '타자 친 손가락 무게중심에 가장 가까운 메뉴를 찾고 있어요',
  },
  constellation: {
    id: 'constellation',
    code: '09',
    name: '글자 별자리',
    shortName: '글자 별자리',
    discipline: '좌표 삼각측량',
    scanningText: '글자들을 밤하늘 좌표에 띄워 별자리를 잇고 있어요',
  },
  morse: {
    id: 'morse',
    code: '10',
    name: '받침 리듬파',
    shortName: '받침 리듬파',
    discipline: '음절 리듬',
    scanningText: '문장의 받침 박자와 가장 닮은 메뉴 리듬을 찾고 있어요',
  },
  periodic: {
    id: 'periodic',
    code: '11',
    name: '원소 조합',
    shortName: '원소 조합',
    discipline: '주기율표',
    scanningText: '단어 획수를 주기율표 원소 번호로 바꿔 합성하고 있어요',
  },
  unicode: {
    id: 'unicode',
    code: '12',
    name: '유니코드',
    shortName: '유니코드',
    discipline: '글자 코드',
    scanningText: '문장의 유니코드 합과 자릿수를 분해해 보고 있어요',
  },
  thermodynamics: {
    id: 'thermodynamics',
    code: '13',
    name: '말투 온도',
    shortName: '말투 온도',
    discipline: '발음 온도',
    scanningText: '모음 비율과 거센소리로 지금 말투 온도를 재고 있어요',
  },
};

export const THEORY_ORDER: TheoryId[] = [
  'conspiracy',
  'fingerprint',
  'clock',
  'weather',
  'fx',
  'moon',
  'numerology',
  'keyboard',
  'constellation',
  'morse',
  'periodic',
  'unicode',
  'thermodynamics',
];

export const EXAMPLE_SENTENCES = [
  '교수님 진도 너무 빨라',
  '오늘 뭐 먹지 아무거나',
  '진짜 집 가고 싶다',
  '과제 언제 다 하냐',
  '배고픈데 나가기 귀찮아',
];

export function getNowClockContext(now = new Date()): ClockContext {
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    weekday: now.getDay() + 1, // 일=1 .. 토=7
  };
}

export function encodeClockContext(ctx: ClockContext): string {
  const mm = String(ctx.month).padStart(2, '0');
  const dd = String(ctx.day).padStart(2, '0');
  const hh = String(ctx.hour).padStart(2, '0');
  return `${mm}${dd}${hh}${ctx.weekday}`;
}

export function decodeClockContext(raw: string | null | undefined): ClockContext | null {
  if (!raw || !/^\d{7}$/.test(raw)) return null;
  const month = Number.parseInt(raw.slice(0, 2), 10);
  const day = Number.parseInt(raw.slice(2, 4), 10);
  const hour = Number.parseInt(raw.slice(4, 6), 10);
  const weekday = Number.parseInt(raw.slice(6, 7), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || weekday < 1 || weekday > 7) {
    return null;
  }
  return { month, day, hour, weekday };
}

const CHO_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const JUNG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];

const JONG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ',
  'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ',
  'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const JAMO_STROKES: Record<string, number> = {
  'ㄱ': 1, 'ㄲ': 2, 'ㄴ': 1, 'ㄷ': 2, 'ㄸ': 4, 'ㄹ': 3, 'ㅁ': 3, 'ㅂ': 4, 'ㅃ': 8,
  'ㅅ': 2, 'ㅆ': 4, 'ㅇ': 1, 'ㅈ': 3, 'ㅉ': 6, 'ㅊ': 4, 'ㅋ': 2, 'ㅌ': 3, 'ㅍ': 4, 'ㅎ': 3,
  'ㄳ': 3, 'ㄵ': 4, 'ㄶ': 4, 'ㄺ': 4, 'ㄻ': 6, 'ㄼ': 7, 'ㄽ': 5, 'ㄾ': 6, 'ㄿ': 7, 'ㅀ': 6, 'ㅄ': 6,
  'ㅏ': 2, 'ㅐ': 3, 'ㅑ': 3, 'ㅒ': 4, 'ㅓ': 2, 'ㅔ': 3, 'ㅕ': 3, 'ㅖ': 4, 'ㅗ': 2, 'ㅘ': 4, 'ㅙ': 5,
  'ㅚ': 3, 'ㅛ': 3, 'ㅜ': 2, 'ㅝ': 4, 'ㅞ': 5, 'ㅟ': 3, 'ㅠ': 3, 'ㅡ': 1, 'ㅢ': 2, 'ㅣ': 1,
};

const YANG_VOWELS = new Set(['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ']);
const YIN_VOWELS = new Set(['ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ']);
const HARSH_CONSONANTS = new Set(['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ', 'ㅎ', 'ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']);
const SONORANT_CONSONANTS = new Set(['ㄴ', 'ㄹ', 'ㅁ', 'ㅇ']);

export const DUBEOLSIK_LAYOUT: { jamo: string; row: number; col: number }[] = [
  { jamo: 'ㅂ', row: 0, col: 0 },
  { jamo: 'ㅈ', row: 0, col: 1 },
  { jamo: 'ㄷ', row: 0, col: 2 },
  { jamo: 'ㄱ', row: 0, col: 3 },
  { jamo: 'ㅅ', row: 0, col: 4 },
  { jamo: 'ㅛ', row: 0, col: 5 },
  { jamo: 'ㅕ', row: 0, col: 6 },
  { jamo: 'ㅑ', row: 0, col: 7 },
  { jamo: 'ㅐ', row: 0, col: 8 },
  { jamo: 'ㅔ', row: 0, col: 9 },
  { jamo: 'ㅁ', row: 1, col: 0.25 },
  { jamo: 'ㄴ', row: 1, col: 1.25 },
  { jamo: 'ㅇ', row: 1, col: 2.25 },
  { jamo: 'ㄹ', row: 1, col: 3.25 },
  { jamo: 'ㅎ', row: 1, col: 4.25 },
  { jamo: 'ㅗ', row: 1, col: 5.25 },
  { jamo: 'ㅓ', row: 1, col: 6.25 },
  { jamo: 'ㅏ', row: 1, col: 7.25 },
  { jamo: 'ㅣ', row: 1, col: 8.25 },
  { jamo: 'ㅋ', row: 2, col: 0.75 },
  { jamo: 'ㅌ', row: 2, col: 1.75 },
  { jamo: 'ㅊ', row: 2, col: 2.75 },
  { jamo: 'ㅍ', row: 2, col: 3.75 },
  { jamo: 'ㅠ', row: 2, col: 4.75 },
  { jamo: 'ㅜ', row: 2, col: 5.75 },
  { jamo: 'ㅡ', row: 2, col: 6.75 },
];

const KEY_MAP = new Map<string, { row: number; col: number }>();
for (const k of DUBEOLSIK_LAYOUT) {
  KEY_MAP.set(k.jamo, { row: k.row, col: k.col });
}

const COMPOUND_JAMO_KEYS: Record<string, string[]> = {
  'ㄲ': ['ㄱ'], 'ㄸ': ['ㄷ'], 'ㅃ': ['ㅂ'], 'ㅆ': ['ㅅ'], 'ㅉ': ['ㅈ'],
  'ㅒ': ['ㅐ'], 'ㅖ': ['ㅔ'],
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'],
  'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'],
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
};

function jamoToKeys(jamo: string): KeyCoord[] {
  if (!jamo) return [];
  const expanded = COMPOUND_JAMO_KEYS[jamo] ?? [jamo];
  const out: KeyCoord[] = [];
  for (const base of expanded) {
    const pos = KEY_MAP.get(base);
    if (pos) {
      out.push({
        jamo: base,
        label: base,
        row: pos.row,
        col: pos.col,
        xMm: Number((pos.col * 19.05).toFixed(1)),
        yMm: Number((pos.row * 19.05).toFixed(1)),
      });
    }
  }
  return out;
}

export function normalizeBaseJamo(jamo: string): string {
  const map: Record<string, string> = {
    'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ',
    'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ', 'ㅘ': 'ㅏ', 'ㅙ': 'ㅐ', 'ㅚ': 'ㅗ',
    'ㅝ': 'ㅓ', 'ㅞ': 'ㅔ', 'ㅟ': 'ㅜ', 'ㅢ': 'ㅡ',
    'ㄳ': 'ㄱ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ', 'ㄺ': 'ㄱ', 'ㄻ': 'ㅁ',
    'ㄼ': 'ㅂ', 'ㄽ': 'ㅅ', 'ㄾ': 'ㅌ', 'ㄿ': 'ㅍ', 'ㅀ': 'ㄹ', 'ㅄ': 'ㅂ',
  };
  return map[jamo] ?? jamo;
}

export function expandJamoUnits(jamo: string): string[] {
  if (!jamo) return [];
  return COMPOUND_JAMO_KEYS[jamo] ?? [jamo];
}

export function analyzeSentence(input: string): SentenceAnalysis {
  const trimmed = input.trim() || '오늘 뭐 먹지';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const spaceCount = (trimmed.match(/\s/g) || []).length;

  const syllables: SyllableAnalysis[] = [];
  const allJamos: SentenceAnalysis['allJamos'] = [];
  const keystrokes: KeyCoord[] = [];

  let totalStrokes = 0;
  let consonantCount = 0;
  let vowelCount = 0;
  let batchimCount = 0;
  let yangVowelCount = 0;
  let yinVowelCount = 0;
  let harshCount = 0;
  let sonorantCount = 0;
  let utf16Sum = 0;
  let utf16Xor = 0;

  const chars = Array.from(trimmed).filter((ch) => !/\s/.test(ch));

  chars.forEach((char, index) => {
    const code = char.charCodeAt(0);
    const hex = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
    utf16Sum += code;
    utf16Xor ^= code;

    if (code >= 0xac00 && code <= 0xd7a3) {
      const offset = code - 0xac00;
      const choIdx = Math.floor(offset / (21 * 28));
      const jungIdx = Math.floor((offset % (21 * 28)) / 28);
      const jongIdx = offset % 28;

      const cho = CHO_LIST[choIdx];
      const jung = JUNG_LIST[jungIdx];
      const jong = JONG_LIST[jongIdx];

      const choStrokes = JAMO_STROKES[cho] ?? 2;
      const jungStrokes = JAMO_STROKES[jung] ?? 2;
      const jongStrokes = jong ? JAMO_STROKES[jong] ?? 2 : 0;
      const st = choStrokes + jungStrokes + jongStrokes;

      totalStrokes += st;
      consonantCount += jong ? 2 : 1;
      vowelCount += 1;
      if (jong) batchimCount += 1;

      const vowelPolarity: SyllableAnalysis['vowelPolarity'] = YANG_VOWELS.has(jung)
        ? 'yang'
        : YIN_VOWELS.has(jung)
        ? 'yin'
        : 'neutral';
      if (vowelPolarity === 'yang') yangVowelCount += 1;
      else if (vowelPolarity === 'yin') yinVowelCount += 1;

      const isHarsh = HARSH_CONSONANTS.has(cho) || (jong !== '' && HARSH_CONSONANTS.has(jong));
      const isSonorant =
        SONORANT_CONSONANTS.has(cho) || (jong !== '' && SONORANT_CONSONANTS.has(jong));
      if (isHarsh) harshCount += 1;
      if (isSonorant) sonorantCount += 1;

      allJamos.push({ jamo: cho, charIdx: index, char, role: '초성' });
      allJamos.push({ jamo: jung, charIdx: index, char, role: '중성' });
      if (jong) allJamos.push({ jamo: jong, charIdx: index, char, role: '종성' });

      const charKeys = [...jamoToKeys(cho), ...jamoToKeys(jung), ...jamoToKeys(jong)];
      keystrokes.push(...charKeys);

      syllables.push({
        index,
        char,
        isHangul: true,
        cho,
        jung,
        jong,
        choIdx,
        jungIdx,
        jongIdx,
        choStrokes,
        jungStrokes,
        jongStrokes,
        totalStrokes: st,
        utf16: code,
        hex,
        vowelPolarity,
        isHarshConsonant: isHarsh,
        isSonorant,
        keys: charKeys,
      });
    } else if (JAMO_STROKES[char]) {
      const st = JAMO_STROKES[char];
      totalStrokes += st;
      consonantCount += 1;
      const isHarsh = HARSH_CONSONANTS.has(char);
      if (isHarsh) harshCount += 1;
      allJamos.push({ jamo: char, charIdx: index, char, role: '초성' });
      const charKeys = jamoToKeys(char);
      keystrokes.push(...charKeys);

      syllables.push({
        index,
        char,
        isHangul: true,
        cho: char,
        jung: '',
        jong: '',
        choIdx: Math.max(0, CHO_LIST.indexOf(char)),
        jungIdx: 0,
        jongIdx: 0,
        choStrokes: st,
        jungStrokes: 0,
        jongStrokes: 0,
        totalStrokes: st,
        utf16: code,
        hex,
        vowelPolarity: 'neutral',
        isHarshConsonant: isHarsh,
        isSonorant: SONORANT_CONSONANTS.has(char),
        keys: charKeys,
      });
    } else {
      const st = /\d/.test(char) ? Math.max(1, Number(char)) : (code % 5) + 1;
      totalStrokes += st;
      const pseudoKey: KeyCoord = {
        jamo: char,
        label: char,
        row: 1,
        col: (code % 9) + 0.25,
        xMm: Number((((code % 9) + 0.25) * 19.05).toFixed(1)),
        yMm: 19.05,
      };
      keystrokes.push(pseudoKey);

      syllables.push({
        index,
        char,
        isHangul: false,
        cho: char,
        jung: '',
        jong: '',
        choIdx: code % 19,
        jungIdx: 0,
        jongIdx: 0,
        choStrokes: st,
        jungStrokes: 0,
        jongStrokes: 0,
        totalStrokes: st,
        utf16: code,
        hex,
        vowelPolarity: 'neutral',
        isHarshConsonant: false,
        isSonorant: false,
        keys: [pseudoKey],
      });
    }
  });

  const strokeValues = syllables.map((s) => s.totalStrokes);
  const firstStrokes = strokeValues[0] ?? 1;
  const lastStrokes = strokeValues[strokeValues.length - 1] ?? 1;
  const maxStrokes = strokeValues.length ? Math.max(...strokeValues) : 1;
  const minStrokes = strokeValues.length ? Math.min(...strokeValues) : 1;

  let travelDistanceMm = 0;
  let sumX = 0;
  let sumY = 0;
  keystrokes.forEach((k, idx) => {
    sumX += k.xMm;
    sumY += k.yMm;
    if (idx > 0) {
      const prev = keystrokes[idx - 1];
      travelDistanceMm += Math.hypot(k.xMm - prev.xMm, k.yMm - prev.yMm);
    }
  });

  const centroidMm =
    keystrokes.length > 0
      ? {
          x: Number((sumX / keystrokes.length).toFixed(1)),
          y: Number((sumY / keystrokes.length).toFixed(1)),
        }
      : { x: 85.7, y: 19.1 };

  return {
    raw: input,
    trimmed,
    syllables,
    totalStrokes,
    charCount: syllables.length,
    wordCount: Math.max(1, words.length),
    spaceCount,
    consonantCount,
    vowelCount,
    batchimCount,
    yangVowelCount,
    yinVowelCount,
    harshCount,
    sonorantCount,
    firstStrokes,
    lastStrokes,
    maxStrokes,
    minStrokes,
    utf16Sum,
    utf16Xor,
    allJamos,
    keystrokes,
    travelDistanceMm: Number(travelDistanceMm.toFixed(1)),
    centroidMm,
  };
}

export interface InvariantTerm {
  name: string;
  symbol: string;
  value: number;
  kind: 'method' | 'sentence' | 'calendar' | 'everyday';
  naturalPhrase: string; // e.g. "지금이 11월이라 11" or "글자 수(10)"
}

export function extractSentenceInvariants(s: SentenceAnalysis): InvariantTerm[] {
  const digitSumStrokes = String(s.totalStrokes)
    .split('')
    .reduce((a, b) => a + Number(b), 0);

  const list: InvariantTerm[] = [
    { name: '총 획수', symbol: `총 획수(${s.totalStrokes})`, value: s.totalStrokes, kind: 'sentence', naturalPhrase: `총 획수(${s.totalStrokes})` },
    { name: '글자 수', symbol: `글자 수(${s.charCount})`, value: s.charCount, kind: 'sentence', naturalPhrase: `글자 수(${s.charCount})` },
    { name: '단어 수', symbol: `단어 수(${s.wordCount})`, value: s.wordCount, kind: 'sentence', naturalPhrase: `단어 수(${s.wordCount})` },
    { name: '띄어쓰기', symbol: `띄어쓰기(${s.spaceCount})`, value: s.spaceCount, kind: 'sentence', naturalPhrase: `띄어쓰기 수(${s.spaceCount})` },
    { name: '자음 개수', symbol: `자음(${s.consonantCount})`, value: s.consonantCount, kind: 'sentence', naturalPhrase: `자음 개수(${s.consonantCount})` },
    { name: '모음 개수', symbol: `모음(${s.vowelCount})`, value: s.vowelCount, kind: 'sentence', naturalPhrase: `모음 개수(${s.vowelCount})` },
    { name: '받침 개수', symbol: `받침(${s.batchimCount})`, value: s.batchimCount, kind: 'sentence', naturalPhrase: `받침 개수(${s.batchimCount})` },
    { name: '첫 글자 획수', symbol: `첫 글자(${s.firstStrokes})`, value: s.firstStrokes, kind: 'sentence', naturalPhrase: `첫 글자 획수(${s.firstStrokes})` },
    { name: '끝 글자 획수', symbol: `끝 글자(${s.lastStrokes})`, value: s.lastStrokes, kind: 'sentence', naturalPhrase: `끝 글자 획수(${s.lastStrokes})` },
    { name: '최대 획수', symbol: `최대 획수(${s.maxStrokes})`, value: s.maxStrokes, kind: 'sentence', naturalPhrase: `가장 복잡한 글자 획수(${s.maxStrokes})` },
    { name: '타자 수', symbol: `타자 수(${s.keystrokes.length})`, value: s.keystrokes.length, kind: 'sentence', naturalPhrase: `타자 횟수(${s.keystrokes.length})` },
    { name: '획수 자릿수 합', symbol: `자릿수 합(${digitSumStrokes})`, value: digitSumStrokes, kind: 'sentence', naturalPhrase: `획수 자릿수 합(${digitSumStrokes})` },
    { name: '밝은 모음', symbol: `밝은 모음(${s.yangVowelCount})`, value: s.yangVowelCount, kind: 'sentence', naturalPhrase: `밝은 모음 수(${s.yangVowelCount})` },
    { name: '어두운 모음', symbol: `어두운 모음(${s.yinVowelCount})`, value: s.yinVowelCount, kind: 'sentence', naturalPhrase: `어두운 모음 수(${s.yinVowelCount})` },
  ];

  return list.filter((t) => t.value > 0);
}

const WEEKDAY_NAMES = ['', '일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function extractContextConstants(
  clockCtx: ClockContext,
  liveData?: LiveWorldData
): InvariantTerm[] {
  const hour12 = clockCtx.hour % 12 || 12;
  const weekdayName = WEEKDAY_NAMES[clockCtx.weekday] ?? '오늘';

  const list: InvariantTerm[] = [
    {
      name: `이번 달(${clockCtx.month}월)`,
      symbol: `이번 달(${clockCtx.month}월)`,
      value: clockCtx.month,
      kind: 'calendar',
      naturalPhrase: `이번 달이 ${clockCtx.month}월이라 ${clockCtx.month}`,
    },
    {
      name: `오늘(${clockCtx.day}일)`,
      symbol: `오늘(${clockCtx.day}일)`,
      value: clockCtx.day,
      kind: 'calendar',
      naturalPhrase: `오늘이 ${clockCtx.day}일이라 ${clockCtx.day}`,
    },
    {
      name: `현재 시각(${hour12}시)`,
      symbol: `현재 시각(${hour12}시)`,
      value: hour12,
      kind: 'calendar',
      naturalPhrase: `지금 ${hour12}시라 ${hour12}`,
    },
    {
      name: `${weekdayName}(${clockCtx.weekday})`,
      symbol: `${weekdayName}(${clockCtx.weekday})`,
      value: clockCtx.weekday,
      kind: 'calendar',
      naturalPhrase: `오늘이 한 주의 ${clockCtx.weekday}번째 날(${weekdayName})이라 ${clockCtx.weekday}`,
    },
  ];

  // Live weather, exchange rate & lunar real-time constants!
  if (liveData) {
    const roundedTemp = Math.round(liveData.weather.tempC);
    if (roundedTemp > 0) {
      list.push({
        name: `현재 기온(${roundedTemp}°)`,
        symbol: `현재 기온(${roundedTemp}°)`,
        value: roundedTemp,
        kind: 'calendar',
        naturalPhrase: `지금 바깥 기온이 ${roundedTemp}°라 ${roundedTemp}`,
      });
    } else if (roundedTemp < 0) {
      const absTemp = Math.abs(roundedTemp);
      list.push({
        name: `영하 기온(${absTemp}°)`,
        symbol: `영하 기온(${absTemp}°)`,
        value: absTemp,
        kind: 'calendar',
        naturalPhrase: `지금 바깥이 영하 ${absTemp}°라 ${absTemp}`,
      });
    }

    const fxDigitSum = String(liveData.fx.usdKrw)
      .split('')
      .reduce((acc, c) => acc + Number(c), 0);
    if (fxDigitSum > 0) {
      list.push({
        name: `환율 자릿수 합(${fxDigitSum})`,
        symbol: `환율 자릿수(${fxDigitSum})`,
        value: fxDigitSum,
        kind: 'calendar',
        naturalPhrase: `지금 원/달러 환율(${liveData.fx.usdKrw.toLocaleString()}원) 자릿수 합이 ${fxDigitSum}이라 ${fxDigitSum}`,
      });
    }

    if (liveData.moon.lunarDay > 0) {
      list.push({
        name: `음력(${liveData.moon.lunarDay}일)`,
        symbol: `음력(${liveData.moon.lunarDay}일)`,
        value: liveData.moon.lunarDay,
        kind: 'calendar',
        naturalPhrase: `오늘이 음력 ${liveData.moon.lunarDay}일차라 ${liveData.moon.lunarDay}`,
      });
    }
  }

  list.push(
    {
      name: '하루 세 끼',
      symbol: '하루 세 끼(3)',
      value: 3,
      kind: 'everyday',
      naturalPhrase: '사람은 하루 세 끼 먹으니까 3',
    },
    {
      name: '젓가락 한 쌍',
      symbol: '젓가락(2짝)',
      value: 2,
      kind: 'everyday',
      naturalPhrase: '젓가락 한 쌍이 2짝이라 2',
    },
    {
      name: '일주일',
      symbol: '일주일(7일)',
      value: 7,
      kind: 'everyday',
      naturalPhrase: '일주일은 7일이라 7',
    },
    {
      name: '사계절',
      symbol: '사계절(4)',
      value: 4,
      kind: 'everyday',
      naturalPhrase: '사계절이 4개라 4',
    },
    {
      name: '한 손가락',
      symbol: '한 손(5)',
      value: 5,
      kind: 'everyday',
      naturalPhrase: '한 손가락이 5개라 5',
    },
    {
      name: '열 손가락',
      symbol: '열 손가락(10)',
      value: 10,
      kind: 'everyday',
      naturalPhrase: '손가락이 열 개라 10',
    },
    {
      name: '1년',
      symbol: '1년(12달)',
      value: 12,
      kind: 'everyday',
      naturalPhrase: '1년은 12달이라 12',
    },
    {
      name: '한글 자음',
      symbol: '한글 자음(14)',
      value: 14,
      kind: 'everyday',
      naturalPhrase: '한글 기본 자음이 14개라 14',
    }
  );

  return list;
}

function numberHasBatchim(n: number): boolean {
  const abs = Math.abs(Math.floor(n));
  if (abs === 0) return true;
  const lastDigit = abs % 10;
  if (lastDigit === 0) return true;
  return [1, 3, 6, 7, 8].includes(lastDigit);
}

export function numJosa(n: number, withBatchim: string, withoutBatchim: string): string {
  return numberHasBatchim(n) ? withBatchim : withoutBatchim;
}

interface CandidateEquation {
  expression: string;
  stepsExplanation: string;
  score: number; // higher = funnier, cleaner, more convincing!
  usesMethodTerm: boolean;
}

export function solveExactBridgeEquation(
  s: SentenceAnalysis,
  targetValue: number,
  variantIndex = 0,
  clockCtx: ClockContext = getNowClockContext(),
  extraMethodTerms: InvariantTerm[] = [],
  liveData?: LiveWorldData
): { expression: string; stepsExplanation: string } {
  const sentenceTerms = [...extraMethodTerms, ...extractSentenceInvariants(s)];
  const contextTerms = extractContextConstants(clockCtx, liveData);
  const allTerms = [...sentenceTerms, ...contextTerms];

  const candidates: CandidateEquation[] = [];
  const tCopula = `${targetValue}${numJosa(targetValue, '이에요', '예요')}`;
  const tSubj = `${targetValue}${numJosa(targetValue, '이', '가')}`;

  const addTwoTerm = (a: InvariantTerm, b: InvariantTerm, allowSymmetric: boolean) => {
    // At least one term MUST come from the user's sentence or method (never pure constant + constant!)
    const aIsInput = a.kind === 'method' || a.kind === 'sentence';
    const bIsInput = b.kind === 'method' || b.kind === 'sentence';
    if (!aIsInput && !bIsInput) return;

    const hasMethod = a.kind === 'method' || b.kind === 'method';
    const hasCalendar = a.kind === 'calendar' || b.kind === 'calendar';
    const hasEveryday = a.kind === 'everyday' || b.kind === 'everyday';

    let baseScore = 40;
    if (hasMethod) baseScore += 35; // Directly builds on Step 1's own measured number!
    if (hasCalendar) baseScore += 28; // "이번 달이 11월이라 +11" — peak relatable humor!
    else if (hasEveryday) baseScore += 18; // "하루 세 끼(3)", "일주일(7)"

    const aEul = numJosa(a.value, '을', '를');
    const bEul = numJosa(b.value, '을', '를');
    const aWa = numJosa(a.value, '과', '와');
    const bRo = b.value % 10 === 1 || b.value % 10 === 7 || b.value % 10 === 8 ? '로' : numJosa(b.value, '으로', '로');

    if (allowSymmetric && a.value + b.value === targetValue) {
      // Put sentence/method term first so it reads naturally: "글자 수(10) + 이번 달(11월) = 21"
      const [first, second] = aIsInput ? [a, b] : [b, a];
      const secEul = numJosa(second.value, '을', '를');
      candidates.push({
        expression: `${first.symbol} + ${second.symbol} = ${targetValue}`,
        stepsExplanation: `${first.naturalPhrase}에 ${second.naturalPhrase}${secEul} 더하면 딱 ${tCopula}.`,
        score: baseScore + 6,
        usesMethodTerm: hasMethod,
      });
    }

    if (a.value - b.value === targetValue) {
      candidates.push({
        expression: `${a.symbol} − ${b.symbol} = ${targetValue}`,
        stepsExplanation: `${a.naturalPhrase}에서 ${b.naturalPhrase}${bEul} 빼면 정확히 ${tSubj} 남아요.`,
        score: baseScore + 5,
        usesMethodTerm: hasMethod,
      });
    }

    if (allowSymmetric && a.value > 1 && b.value > 1 && a.value * b.value === targetValue) {
      const [first, second] = aIsInput ? [a, b] : [b, a];
      const fWa = numJosa(first.value, '과', '와');
      const sEul = numJosa(second.value, '을', '를');
      candidates.push({
        expression: `${first.symbol} × ${second.symbol} = ${targetValue}`,
        stepsExplanation: `${first.naturalPhrase}${fWa} ${second.naturalPhrase}${sEul} 곱해 보니 딱 ${tCopula}.`,
        score: baseScore + 4,
        usesMethodTerm: hasMethod,
      });
    }

    if (b.value > 1 && a.value % b.value === 0 && a.value / b.value === targetValue) {
      candidates.push({
        expression: `${a.symbol} ÷ ${b.symbol} = ${targetValue}`,
        stepsExplanation: `${a.naturalPhrase}${aEul} ${b.naturalPhrase}${bRo} 나누면 깔끔하게 ${tCopula}.`,
        score: baseScore + 3,
        usesMethodTerm: hasMethod,
      });
    }
    void aWa;
  };

  // Pass 1: 2-term equations (cleanest & most immediately convincing!)
  for (let i = 0; i < allTerms.length; i++) {
    for (let j = 0; j < allTerms.length; j++) {
      if (i === j) continue;
      addTwoTerm(allTerms[i], allTerms[j], i < j);
    }
  }

  // Pass 2: 3-term equations when Pass 1 didn't find enough candidates OR didn't anchor to a method term!
  const hasMethodHitInPass1 = candidates.some((c) => c.usesMethodTerm);
  if (candidates.length < 8 || (extraMethodTerms.length > 0 && !hasMethodHitInPass1)) {
    const primaryPool =
      extraMethodTerms.length > 0 && !hasMethodHitInPass1
        ? extraMethodTerms
        : sentenceTerms.slice(0, 8);
    const secondaryPool = [...contextTerms.slice(0, 10), ...sentenceTerms.slice(0, 6)];

    for (let i = 0; i < primaryPool.length && candidates.length < 30; i++) {
      const a = primaryPool[i];
      for (let j = 0; j < secondaryPool.length && candidates.length < 30; j++) {
        const b = secondaryPool[j];
        if (a.symbol === b.symbol) continue;

        const intermediates = [
          {
            val: a.value + b.value,
            expr: `(${a.symbol} + ${b.symbol})`,
            desc: `${a.naturalPhrase}에 ${b.naturalPhrase}${numJosa(b.value, '을', '를')} 더한 값(${a.value + b.value})`,
          },
          {
            val: a.value - b.value,
            expr: `(${a.symbol} − ${b.symbol})`,
            desc: `${a.naturalPhrase}에서 ${b.naturalPhrase}${numJosa(b.value, '을', '를')} 뺀 값(${a.value - b.value})`,
          },
        ];

        for (const mid of intermediates) {
          if (mid.val <= 0) continue;
          for (let k = 0; k < contextTerms.length && candidates.length < 30; k++) {
            const c = contextTerms[k];
            if (c.symbol === b.symbol) continue;
            const cEul = numJosa(c.value, '을', '를');
            const bonus = (a.kind === 'method' ? 20 : 0) + (b.kind === 'calendar' || c.kind === 'calendar' ? 15 : 6);

            if (mid.val + c.value === targetValue) {
              candidates.push({
                expression: `${mid.expr} + ${c.symbol} = ${targetValue}`,
                stepsExplanation: `${mid.desc}에 ${c.naturalPhrase}${cEul} 더하면 딱 ${tCopula}.`,
                score: 25 + bonus,
                usesMethodTerm: a.kind === 'method' || b.kind === 'method',
              });
            } else if (mid.val - c.value === targetValue) {
              candidates.push({
                expression: `${mid.expr} − ${c.symbol} = ${targetValue}`,
                stepsExplanation: `${mid.desc}에서 ${c.naturalPhrase}${cEul} 빼면 딱 ${tSubj} 나와요.`,
                score: 25 + bonus,
                usesMethodTerm: a.kind === 'method' || b.kind === 'method',
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate by expression and sort highest-quality witty formulas first
  const seen = new Set<string>();
  const unique = candidates
    .filter((c) => {
      if (seen.has(c.expression)) return false;
      seen.add(c.expression);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  if (unique.length > 0) {
    // Strictly prefer equations anchored to the method's own Step 1 measurement when available!
    const methodAnchored = unique.filter((c) => c.usesMethodTerm);
    const pool = methodAnchored.length > 0 ? methodAnchored : unique;
    const topBand = pool.slice(0, Math.min(4, pool.length));
    const chosen = topBand[variantIndex % topBand.length];
    return { expression: chosen.expression, stepsExplanation: chosen.stepsExplanation };
  }

  // Direct exact sentence match fallback (no fake magic constants ever!)
  const direct = sentenceTerms.find((t) => t.value === targetValue);
  if (direct) {
    return {
      expression: `${direct.symbol} = ${targetValue}`,
      stepsExplanation: `${direct.naturalPhrase} 자체가 그냥 딱 ${tCopula}.`,
    };
  }

  // Pure factual calendar-modulo bridge fallback (guarantees 100% real arithmetic even on extreme inputs)
  const base = sentenceTerms[0] ?? { symbol: `글자 수(${s.charCount})`, value: s.charCount, naturalPhrase: `글자 수(${s.charCount})` };
  const diff = targetValue - base.value;
  if (diff === 0) {
    return {
      expression: `${base.symbol} = ${targetValue}`,
      stepsExplanation: `${base.naturalPhrase} 그대로 딱 ${tCopula}.`,
    };
  }
  const absDiff = Math.abs(diff);
  const sign = diff > 0 ? '+' : '−';
  const verb = diff > 0 ? '더하면' : '빼면';
  return {
    expression: `${base.symbol} ${sign} (1 × ${absDiff}) = ${targetValue}`,
    stepsExplanation: `${base.naturalPhrase}에서 한 숟가락(1)씩 ${absDiff}번 ${verb} 딱 ${tCopula}.`,
  };
}
