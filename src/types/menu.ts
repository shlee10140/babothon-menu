export type TheoryId =
  | 'conspiracy'
  | 'fingerprint'
  | 'clock'
  | 'weather'
  | 'fx'
  | 'moon'
  | 'numerology'
  | 'keyboard'
  | 'constellation'
  | 'morse'
  | 'periodic'
  | 'unicode'
  | 'thermodynamics';

export interface TheoryMeta {
  id: TheoryId;
  code: string;
  name: string;
  shortName: string;
  discipline: string;
  scanningText: string;
}

export interface ClockContext {
  month: number;   // 1..12
  day: number;     // 1..31
  hour: number;    // 0..23
  weekday: number; // 1(일)..7(토)
}

export interface LiveWeatherData {
  tempC: number;
  humidity: number;
  windKmh: number;
  weatherCode: number;
  isLive: boolean;
}

export interface LiveFxData {
  usdKrw: number;
  isLive: boolean;
}

export interface LiveMoonData {
  illuminationPct: number;
  lunarDay: number;
  phaseRatio: number; // 0..1 (0 = new, 0.5 = full)
  phaseName: string;
}

export interface LiveWorldData {
  clock: ClockContext;
  weather: LiveWeatherData;
  fx: LiveFxData;
  moon: LiveMoonData;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  zone: string;
  tempProfile?: 'hot' | 'warm' | 'cool';
  enabled: boolean;
  isCustom?: boolean;
}

export interface KeyCoord {
  jamo: string;
  label: string;
  row: number;
  col: number;
  xMm: number;
  yMm: number;
}

export interface SyllableAnalysis {
  index: number;
  char: string;
  isHangul: boolean;
  cho: string;
  jung: string;
  jong: string;
  choIdx: number;
  jungIdx: number;
  jongIdx: number;
  choStrokes: number;
  jungStrokes: number;
  jongStrokes: number;
  totalStrokes: number;
  utf16: number;
  hex: string;
  vowelPolarity: 'yang' | 'yin' | 'neutral';
  isHarshConsonant: boolean;
  isSonorant: boolean;
  keys: KeyCoord[];
}

export interface SentenceAnalysis {
  raw: string;
  trimmed: string;
  syllables: SyllableAnalysis[];
  totalStrokes: number;
  charCount: number;
  wordCount: number;
  spaceCount: number;
  consonantCount: number;
  vowelCount: number;
  batchimCount: number;
  yangVowelCount: number;
  yinVowelCount: number;
  harshCount: number;
  sonorantCount: number;
  firstStrokes: number;
  lastStrokes: number;
  maxStrokes: number;
  minStrokes: number;
  utf16Sum: number;
  utf16Xor: number;
  allJamos: { jamo: string; charIdx: number; char: string; role: '초성' | '중성' | '종성' }[];
  keystrokes: KeyCoord[];
  travelDistanceMm: number;
  centroidMm: { x: number; y: number };
}

export interface ProofStep {
  label: string;
  title: string;
  formula: string;
  explanation: string;
}

export interface ConspiracyMatch {
  menuCharIdx: number;
  menuJamo: string;
  sourceCharIdx: number;
  sourceChar: string;
  sourceJamo: string;
  sourceRole: '초성' | '받침';
  shift: number;
  note: string;
}

export interface PeriodicTerm {
  symbol: string;
  korName: string;
  atomicNumber: number;
  sourceChunk: string;
}

export interface ConstellationStar {
  char: string;
  x: number; // 0..100
  y: number; // 0..100
  strokes: number;
}

export interface MorseBeat {
  char: string;
  isLong: boolean; // true = 받침 있음 (—), false = 받침 없음 (·)
  amplitude: number; // 0.3..1
}

export interface ClockMetrics {
  startHour12: number;
  rawHour24: number;
  turnSteps: number;
  endHour12: number;
  startDeg: number;
  endDeg: number;
}

export interface FingerprintToken {
  jamo: string;
  matched: boolean;
  syllableChar: string;
}

export interface FingerprintMetrics {
  matchPct: number;
  matchedCount: number;
  totalCount: number;
  tokens: FingerprintToken[];
}

export interface WeatherMetrics {
  tempC: number;
  humidity: number;
  windKmh: number;
  skyLabel: string;
  icon: 'sun' | 'partly' | 'cloud' | 'rain' | 'snow';
  moodLabel: string;
  isLive: boolean;
}

export interface FxMetrics {
  usdKrw: number;
  digits: number[];
  digitSum: number;
  points: number[]; // normalized 0..1 sparkline y points
  isLive: boolean;
}

export interface MoonMetrics {
  illuminationPct: number;
  lunarDay: number;
  phaseRatio: number;
  phaseName: string;
}

export interface ProofResult {
  proofId: string;
  theory: TheoryMeta;
  sentence: SentenceAnalysis;
  menu: MenuItem;
  menuAnalysis: SentenceAnalysis;
  confidencePct: number;
  theoremTitle: string;
  bridgeExpression: string;
  steps: ProofStep[];
  qedLine: string;
  conspiracyMatches?: ConspiracyMatch[];
  fingerprintMetrics?: FingerprintMetrics;
  clockMetrics?: ClockMetrics;
  weatherMetrics?: WeatherMetrics;
  fxMetrics?: FxMetrics;
  moonMetrics?: MoonMetrics;
  periodicTerms?: PeriodicTerm[];
  constellation?: {
    stars: ConstellationStar[];
    apexAngleDeg: number;
    constellationName: string;
  };
  morse?: {
    beats: MorseBeat[];
    patternText: string;
    menuPatternText: string;
    bpm: number;
  };
  thermoMetrics?: {
    excitationPct: number;
    yangPct: number;
    yinPct: number;
    entropyval: number;
    requiredCounterBalance: string;
  };
  unicodeFactors?: {
    sumHex: string;
    xorHex: string;
    primeFactorsText: string;
    digitSum: number;
    modulus: number;
    remainder: number;
  };
}
