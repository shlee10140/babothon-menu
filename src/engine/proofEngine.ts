import {
  ClockContext,
  ClockMetrics,
  ConspiracyMatch,
  ConstellationStar,
  FingerprintMetrics,
  FingerprintToken,
  FxMetrics,
  LiveWorldData,
  MenuItem,
  MoonMetrics,
  MorseBeat,
  PeriodicTerm,
  ProofResult,
  ProofStep,
  SentenceAnalysis,
  TheoryId,
  WeatherMetrics,
} from '../types/menu';
import {
  analyzeSentence,
  expandJamoUnits,
  InvariantTerm,
  normalizeBaseJamo,
  numJosa,
  solveExactBridgeEquation,
  THEORIES,
  THEORY_ORDER,
} from './hangulMath';
import { createInitialLiveData, describeWmoWeather } from './liveData';

const ELEMENTS: { z: number; sym: string; kor: string }[] = [
  { z: 1, sym: 'H', kor: '수소' },
  { z: 2, sym: 'He', kor: '헬륨' },
  { z: 3, sym: 'Li', kor: '리튬' },
  { z: 4, sym: 'Be', kor: '베릴륨' },
  { z: 5, sym: 'B', kor: '붕소' },
  { z: 6, sym: 'C', kor: '탄소' },
  { z: 7, sym: 'N', kor: '질소' },
  { z: 8, sym: 'O', kor: '산소' },
  { z: 9, sym: 'F', kor: '플루오린' },
  { z: 10, sym: 'Ne', kor: '네온' },
  { z: 11, sym: 'Na', kor: '나트륨' },
  { z: 12, sym: 'Mg', kor: '마그네슘' },
  { z: 13, sym: 'Al', kor: '알루미늄' },
  { z: 14, sym: 'Si', kor: '규소' },
  { z: 15, sym: 'P', kor: '인' },
  { z: 16, sym: 'S', kor: '황' },
  { z: 17, sym: 'Cl', kor: '염소' },
  { z: 18, sym: 'Ar', kor: '아르곤' },
  { z: 19, sym: 'K', kor: '칼륨' },
  { z: 20, sym: 'Ca', kor: '칼슘' },
  { z: 22, sym: 'Ti', kor: '타이타늄' },
  { z: 24, sym: 'Cr', kor: '크로뮴' },
  { z: 25, sym: 'Mn', kor: '망가니즈' },
  { z: 26, sym: 'Fe', kor: '철' },
  { z: 29, sym: 'Cu', kor: '구리' },
  { z: 30, sym: 'Zn', kor: '아연' },
  { z: 47, sym: 'Ag', kor: '은' },
  { z: 79, sym: 'Au', kor: '금' },
];

const BASIC_CONSONANT_RING = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export function hasBatchim(word: string): boolean {
  if (!word) return false;
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return false;
  return (last - 0xac00) % 28 !== 0;
}

export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

function factorizeSmallInt(n: number): string {
  let val = Math.max(2, Math.abs(Math.floor(n)));
  const factors: { p: number; e: number }[] = [];
  for (let d = 2; d * d <= val && d <= 997; d++) {
    if (val % d === 0) {
      let count = 0;
      while (val % d === 0) {
        val /= d;
        count++;
      }
      factors.push({ p: d, e: count });
    }
  }
  if (val > 1) factors.push({ p: val, e: 1 });
  if (factors.length === 0) return String(n);
  return factors.map((f) => (f.e > 1 ? `${f.p}^${f.e}` : `${f.p}`)).join(' × ');
}

function digitSum(n: number): number {
  return String(Math.abs(Math.floor(n)))
    .split('')
    .reduce((acc, ch) => acc + Number(ch), 0);
}

/**
 * STRICT genuine consonant finder:
 * Matches every syllable's initial consonant of the menu against REAL consonants
 * (초성 or 종성/받침) present inside the user's sentence — ZERO fake random shifts!
 */
function buildStrictConspiracyMatches(
  sentence: SentenceAnalysis,
  menuAnalysis: SentenceAnalysis
): { matches: ConspiracyMatch[]; isCompleteExact: boolean; uniformShift: number } {
  // Collect all real consonant occurrences in the sentence (both 초성 and expanded 받침!)
  const occurrences: {
    baseJamo: string;
    rawJamo: string;
    charIdx: number;
    char: string;
    role: '초성' | '받침';
  }[] = [];

  sentence.syllables.forEach((syl) => {
    if (!syl.isHangul) return;
    occurrences.push({
      baseJamo: normalizeBaseJamo(syl.cho),
      rawJamo: syl.cho,
      charIdx: syl.index,
      char: syl.char,
      role: '초성',
    });
    if (syl.jong) {
      for (const unit of expandJamoUnits(syl.jong)) {
        occurrences.push({
          baseJamo: normalizeBaseJamo(unit),
          rawJamo: unit,
          charIdx: syl.index,
          char: syl.char,
          role: '받침',
        });
      }
    }
  });

  // Helper to try matching all menu initials with a uniform shift (0 = exact real letters!)
  const tryMatchWithUniformShift = (shift: number): ConspiracyMatch[] | null => {
    const usedCharIndices = new Set<number>();
    const usedOccurrenceIndices = new Set<number>();
    const found: ConspiracyMatch[] = [];

    for (let mIdx = 0; mIdx < menuAnalysis.syllables.length; mIdx++) {
      const mSyl = menuAnalysis.syllables[mIdx];
      const targetBase = normalizeBaseJamo(mSyl.cho);
      const targetRingIdx = BASIC_CONSONANT_RING.indexOf(targetBase);
      if (targetRingIdx === -1) return null;

      // We want sourceBase such that (sourceIdx + shift) % 14 === targetRingIdx
      const neededSourceIdx =
        (targetRingIdx - shift + BASIC_CONSONANT_RING.length * 4) % BASIC_CONSONANT_RING.length;
      const neededSourceBase = BASIC_CONSONANT_RING[neededSourceIdx];

      // Priority 1: match from a syllable not yet used (cleanest visual bezier arcs!)
      let pickIdx = occurrences.findIndex(
        (o, idx) =>
          o.baseJamo === neededSourceBase &&
          !usedOccurrenceIndices.has(idx) &&
          !usedCharIndices.has(o.charIdx)
      );
      // Priority 2: match another Jamo slot (e.g. 받침 vs 초성) if syllable count is tight
      if (pickIdx === -1) {
        pickIdx = occurrences.findIndex(
          (o, idx) => o.baseJamo === neededSourceBase && !usedOccurrenceIndices.has(idx)
        );
      }
      if (pickIdx === -1) return null;

      usedOccurrenceIndices.add(pickIdx);
      usedCharIndices.add(occurrences[pickIdx].charIdx);
      const hit = occurrences[pickIdx];
      const roleHint = hit.role === '받침' ? `받침 ${hit.rawJamo}` : hit.rawJamo;
      const note =
        shift === 0
          ? `‘${hit.char}’(${roleHint})`
          : `‘${hit.char}’(${hit.rawJamo}+${shift}→${mSyl.cho})`;

      found.push({
        menuCharIdx: mIdx,
        menuJamo: mSyl.cho,
        sourceCharIdx: hit.charIdx,
        sourceChar: hit.char,
        sourceJamo: hit.rawJamo,
        sourceRole: hit.role,
        shift,
        note,
      });
    }

    return found;
  };

  // 1. Try 100% genuine exact match (shift = 0)
  const exact = tryMatchWithUniformShift(0);
  if (exact) {
    return { matches: exact, isCompleteExact: true, uniformShift: 0 };
  }

  // 2. Only if forced (e.g. shared URL on very short sentence), search for a SINGLE uniform Caesar shift (+1..+13)
  for (let shift = 1; shift < BASIC_CONSONANT_RING.length; shift++) {
    const shifted = tryMatchWithUniformShift(shift);
    if (shifted) {
      return { matches: shifted, isCompleteExact: false, uniformShift: shift };
    }
  }

  // 3. Last resort fallback if sentence has fewer consonants than menu
  const fallback: ConspiracyMatch[] = menuAnalysis.syllables.map((mSyl, mIdx) => {
    const sSyl = sentence.syllables[mIdx % Math.max(1, sentence.syllables.length)];
    return {
      menuCharIdx: mIdx,
      menuJamo: mSyl.cho,
      sourceCharIdx: sSyl?.index ?? 0,
      sourceChar: sSyl?.char ?? sentence.trimmed[0] ?? '오',
      sourceJamo: sSyl?.cho ?? mSyl.cho,
      sourceRole: '초성',
      shift: 0,
      note: `‘${sSyl?.char ?? ''}’→${mSyl.cho}`,
    };
  });
  return { matches: fallback, isCompleteExact: false, uniformShift: 0 };
}

/**
 * Genuine Jamo Fingerprint overlap score between sentence and menu!
 */
function computeFingerprint(
  sentence: SentenceAnalysis,
  menuAnalysis: SentenceAnalysis
): FingerprintMetrics {
  const sentenceJamoSet = new Set<string>();
  sentence.syllables.forEach((s) => {
    if (!s.isHangul) return;
    sentenceJamoSet.add(normalizeBaseJamo(s.cho));
    for (const u of expandJamoUnits(s.jung)) sentenceJamoSet.add(normalizeBaseJamo(u));
    for (const u of expandJamoUnits(s.jong)) sentenceJamoSet.add(normalizeBaseJamo(u));
  });

  const tokens: FingerprintToken[] = [];
  menuAnalysis.syllables.forEach((ms) => {
    if (!ms.isHangul) return;
    const pieces = [ms.cho, ...expandJamoUnits(ms.jung), ...expandJamoUnits(ms.jong)].filter(Boolean);
    pieces.forEach((jamo) => {
      const matched = sentenceJamoSet.has(normalizeBaseJamo(jamo));
      tokens.push({ jamo, matched, syllableChar: ms.char });
    });
  });

  const totalCount = Math.max(1, tokens.length);
  const matchedCount = tokens.filter((t) => t.matched).length;
  const matchPct = Math.round((matchedCount / totalCount) * 100);

  return { matchPct, matchedCount, totalCount, tokens };
}

function computeClockMetrics(sentence: SentenceAnalysis, clockCtx: ClockContext): ClockMetrics {
  const startHour12 = clockCtx.hour % 12 || 12;
  const turnSteps = sentence.charCount;
  const endHour12 = ((startHour12 - 1 + turnSteps) % 12) + 1;
  const startDeg = (startHour12 % 12) * 30;
  // Spin visibly forward between 120° and 420° so the hand sweeps satisfyingly
  const visualRevs = turnSteps % 12 === 0 ? 12 : turnSteps % 12;
  const endDeg = startDeg + visualRevs * 30;

  return {
    startHour12,
    rawHour24: clockCtx.hour,
    turnSteps,
    endHour12,
    startDeg,
    endDeg,
  };
}

function computeThermoExcitation(sentence: SentenceAnalysis): number {
  return Math.min(
    98,
    Math.max(
      14,
      Math.round(
        ((sentence.harshCount * 2.2 + sentence.batchimCount) / Math.max(1, sentence.charCount * 2)) *
          100
      )
    )
  );
}

const DEFAULT_FALLBACK_MENU: MenuItem = {
  id: 'fallback',
  name: '돼지국밥',
  category: '한식',
  zone: '북문',
  tempProfile: 'hot',
  enabled: true,
};

/**
 * Smart anti-repeat picker that pairs each calculation method ONLY with menus
 * that GENUINELY satisfy that method's mathematical/physical rule!
 */
export function pickFreshTheoryAndMenu(
  inputText: string,
  menus: MenuItem[],
  recentTheories: TheoryId[],
  recentMenuIds: string[],
  liveData: LiveWorldData = createInitialLiveData()
): { theoryId: TheoryId; menuId: string } {
  const clockCtx = liveData.clock;
  const activeMenus = menus.filter((m) => m.enabled);
  const safeMenus = activeMenus.length > 0 ? activeMenus : [DEFAULT_FALLBACK_MENU];
  const sentence = analyzeSentence(inputText);

  const unusedMenus = safeMenus.filter((m) => !recentMenuIds.includes(m.id));
  const menuPool =
    unusedMenus.length > 0
      ? unusedMenus
      : safeMenus.filter((m) => m.id !== recentMenuIds[recentMenuIds.length - 1]);
  const finalMenuPool = menuPool.length > 0 ? menuPool : safeMenus;

  const exactConspiracyMenus = finalMenuPool.filter(
    (m) => buildStrictConspiracyMatches(sentence, analyzeSentence(m.name)).isCompleteExact
  );

  const eligibleTheories = THEORY_ORDER.filter((t) => {
    if (t === 'conspiracy' && exactConspiracyMenus.length === 0) return false;
    return true;
  });

  const unusedTheories = eligibleTheories.filter((t) => !recentTheories.includes(t));
  const theoryPool =
    unusedTheories.length > 0
      ? unusedTheories
      : eligibleTheories.filter((t) => t !== recentTheories[recentTheories.length - 1]);
  const chosenTheoryPool = theoryPool.length > 0 ? theoryPool : eligibleTheories;
  const theoryId =
    chosenTheoryPool[Math.floor(Math.random() * chosenTheoryPool.length)] ?? 'numerology';

  if (theoryId === 'conspiracy' && exactConspiracyMenus.length > 0) {
    const chosen = exactConspiracyMenus[Math.floor(Math.random() * exactConspiracyMenus.length)];
    return { theoryId, menuId: chosen.id };
  }

  if (theoryId === 'weather') {
    const { tempC, weatherCode } = liveData.weather;
    const isColdOrWet = tempC <= 12 || weatherCode >= 51;
    const isHot = tempC >= 24;
    const wanted = isColdOrWet ? 'hot' : isHot ? 'cool' : 'warm';
    const matching = finalMenuPool.filter((m) => (m.tempProfile ?? 'warm') === wanted);
    const pool = matching.length > 0 ? matching : finalMenuPool;
    return { theoryId, menuId: pool[Math.floor(Math.random() * pool.length)].id };
  }

  if (theoryId === 'fx') {
    const fxSum = digitSum(liveData.fx.usdKrw);
    const lucky = new Set([
      fxSum,
      fxSum + sentence.wordCount,
      fxSum + sentence.charCount,
      Math.abs(fxSum - sentence.wordCount),
      Math.abs(fxSum - 3),
      fxSum + 3,
      fxSum + 7,
      fxSum - 2,
      fxSum + 2,
    ]);
    const clean = finalMenuPool.filter((m) => lucky.has(analyzeSentence(m.name).totalStrokes));
    const pool = clean.length > 0 ? clean : finalMenuPool;
    return { theoryId, menuId: pool[Math.floor(Math.random() * pool.length)].id };
  }

  if (theoryId === 'moon') {
    const mDay = liveData.moon.lunarDay;
    const mDig = digitSum(liveData.moon.illuminationPct);
    const lucky = new Set([
      mDay + sentence.wordCount,
      mDay + sentence.charCount,
      Math.abs(mDay - sentence.wordCount),
      mDig + liveData.clock.month,
      mDig + sentence.charCount,
    ]);
    const clean = finalMenuPool.filter((m) => lucky.has(analyzeSentence(m.name).totalStrokes));
    const pool = clean.length > 0 ? clean : finalMenuPool;
    return { theoryId, menuId: pool[Math.floor(Math.random() * pool.length)].id };
  }

  if (theoryId === 'fingerprint') {
    const ranked = finalMenuPool
      .map((m) => ({
        menu: m,
        score: computeFingerprint(sentence, analyzeSentence(m.name)).matchPct,
      }))
      .sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, Math.min(4, ranked.length));
    return { theoryId, menuId: top[Math.floor(Math.random() * top.length)].menu.id };
  }

  if (theoryId === 'keyboard') {
    const ranked = finalMenuPool
      .map((m) => {
        const ma = analyzeSentence(m.name);
        const dist = Math.hypot(
          sentence.centroidMm.x - ma.centroidMm.x,
          sentence.centroidMm.y - ma.centroidMm.y
        );
        return { menu: m, dist };
      })
      .sort((a, b) => a.dist - b.dist);
    const top = ranked.slice(0, Math.min(3, ranked.length));
    return { theoryId, menuId: top[Math.floor(Math.random() * top.length)].menu.id };
  }

  if (theoryId === 'morse') {
    const sentRatio = sentence.batchimCount / Math.max(1, sentence.charCount);
    const ranked = finalMenuPool
      .map((m) => {
        const ma = analyzeSentence(m.name);
        const mRatio = ma.batchimCount / Math.max(1, ma.charCount);
        return { menu: m, diff: Math.abs(sentRatio - mRatio) };
      })
      .sort((a, b) => a.diff - b.diff);
    const top = ranked.slice(0, Math.min(4, ranked.length));
    return { theoryId, menuId: top[Math.floor(Math.random() * top.length)].menu.id };
  }

  if (theoryId === 'thermodynamics') {
    const temp = computeThermoExcitation(sentence);
    const targetProfiles = temp >= 52 ? ['hot', 'cool'] : ['warm', 'hot'];
    const matching = finalMenuPool.filter((m) =>
      targetProfiles.includes(m.tempProfile ?? 'warm')
    );
    const pool = matching.length > 0 ? matching : finalMenuPool;
    return { theoryId, menuId: pool[Math.floor(Math.random() * pool.length)].id };
  }

  if (theoryId === 'clock') {
    const cm = computeClockMetrics(sentence, clockCtx);
    // Prefer menus whose strokes equal endHour12 + month, endHour12 + day, etc.
    const luckyTargets = new Set([
      cm.endHour12 + clockCtx.month,
      Math.abs(clockCtx.day - cm.endHour12),
      cm.endHour12 + 7,
      cm.endHour12 + 10,
      cm.endHour12 + 12,
      cm.endHour12 * 2,
      cm.endHour12 * 3,
    ]);
    const superClean = finalMenuPool.filter((m) =>
      luckyTargets.has(analyzeSentence(m.name).totalStrokes)
    );
    const pool = superClean.length > 0 ? superClean : finalMenuPool;
    return { theoryId, menuId: pool[Math.floor(Math.random() * pool.length)].id };
  }

  const chosenMenu = finalMenuPool[Math.floor(Math.random() * finalMenuPool.length)];
  return { theoryId, menuId: chosenMenu.id };
}

export function generateProof(
  inputText: string,
  menus: MenuItem[],
  theoryId: TheoryId,
  targetMenuId: string,
  variantSeed = 0,
  liveData: LiveWorldData = createInitialLiveData()
): ProofResult {
  const clockCtx = liveData.clock;
  const sentence = analyzeSentence(inputText);
  const theory = THEORIES[theoryId] ?? THEORIES[THEORY_ORDER[0]];

  const activeMenus = menus.filter((m) => m.enabled);
  const menu =
    activeMenus.find((m) => m.id === targetMenuId) ??
    activeMenus[0] ??
    DEFAULT_FALLBACK_MENU;
  const menuAnalysis = analyzeSentence(menu.name);

  const menuStrokeBreakdown = menuAnalysis.syllables
    .map((s) => `${s.char}(${s.totalStrokes})`)
    .join(' + ');
  const theoryOrderIdx = Math.max(0, THEORY_ORDER.indexOf(theoryId));
  const seed = theoryOrderIdx * 5 + variantSeed;

  const solveBridge = (extraTerms: InvariantTerm[] = []) =>
    solveExactBridgeEquation(
      sentence,
      menuAnalysis.totalStrokes,
      seed,
      clockCtx,
      extraTerms,
      liveData
    );

  const confidencePct = 100;
  const proofId = `M-${String((sentence.utf16Sum % 8999) + 1000)}`;
  const menuSubject = `${menu.name}${josa(menu.name, '이', '가')}`;
  const menuCopula = `${menu.name}${josa(menu.name, '이에요', '예요')}`;

  // 1. 초성 찾기 (100% 실제 자모 일치!)
  if (theoryId === 'conspiracy') {
    const { matches, isCompleteExact, uniformShift } = buildStrictConspiracyMatches(
      sentence,
      menuAnalysis
    );
    const bridge = solveBridge();

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '숨어 있는 초성',
        formula: matches.map((m) => m.note).join(' · '),
        explanation: isCompleteExact
          ? `문장의 초성과 받침을 살펴보니 ‘${menu.name}’ 초성이 하나도 빠짐없이 그대로 들어 있어요.`
          : uniformShift > 0
          ? `문장 자음을 가나다순으로 똑같이 ${uniformShift}칸씩 밀어 보니 ‘${menu.name}’ 초성이 그대로 나와요.`
          : `문장 속 글자 자음 배열이 ‘${menu.name}’ 초성 흐름으로 이어져 있어요.`,
      },
      {
        label: '2',
        title: '획수까지 검증',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '결론',
        formula: `[ ${menuAnalysis.syllables.map((s) => s.cho).join(' · ')} ] + ${menuAnalysis.totalStrokes}획 = ${menu.name}`,
        explanation: `숨은 초성에 ${menuAnalysis.totalStrokes}획 조건까지 맞춰 보니 딱 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: isCompleteExact
        ? `방금 적으신 글자에 ‘${menu.name}’ 초성이 하나도 빠짐없이 숨어 있었어요.`
        : `자음을 똑같이 ${uniformShift}칸씩 밀어 보니 ‘${menu.name}’ 초성이 딱 나오네요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      conspiracyMatches: matches,
    };
  }

  // 2. 발음 지문 (NEW — 실제 자모 겹침 비율!)
  if (theoryId === 'fingerprint') {
    const fp = computeFingerprint(sentence, menuAnalysis);
    const matchedUnique = Array.from(
      new Set(fp.tokens.filter((t) => t.matched).map((t) => t.jamo))
    );
    const fpTerm: InvariantTerm = {
      name: '겹친 자모 수',
      symbol: `겹친 자모(${fp.matchedCount}개)`,
      value: fp.matchedCount,
      kind: 'method',
      naturalPhrase: `문장과 겹친 자모(${fp.matchedCount}개)`,
    };
    const bridge = solveBridge(fp.matchedCount > 0 ? [fpTerm] : []);

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '자음·모음 대조',
        formula: `일치 자모 ${fp.matchedCount}/${fp.totalCount}개 (${fp.matchPct}%) · ${matchedUnique.slice(0, 7).join(' ')}`,
        explanation: `방금 쓰신 문장의 자음·모음을 분해해 대조하니 ‘${menu.name}’ 발음 재료의 ${fp.matchPct}%가 이미 들어 있어요.`,
      },
      {
        label: '2',
        title: '획수 공식 검증',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '발음 지문 일치',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획 (${fp.matchPct}% 일치)`,
        explanation: `입에서 나온 자모 재료가 가장 많이 겹치는 메뉴는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `방금 쓰신 자음·모음이 ‘${menu.name}’ 발음 재료와 ${fp.matchPct}%나 겹쳐요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      fingerprintMetrics: fp,
    };
  }

  // 3. 시계 각도 (NEW — 실제 현재 시각 + 글자 수만큼 시계 바늘 회전!)
  if (theoryId === 'clock') {
    const cm = computeClockMetrics(sentence, clockCtx);
    const clockTerm: InvariantTerm = {
      name: `시계 눈금(${cm.endHour12}시)`,
      symbol: `시계 눈금(${cm.endHour12}시)`,
      value: cm.endHour12,
      kind: 'method',
      naturalPhrase: `바늘이 멈춘 ${cm.endHour12}시 눈금(${cm.endHour12})`,
    };
    const bridge = solveBridge([clockTerm]);

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '시계 바늘 회전',
        formula: `현재 ${cm.startHour12}시 + ${cm.turnSteps}글자(${cm.turnSteps * 30}°) → ${cm.endHour12}시 방향`,
        explanation: `지금 ${cm.startHour12}시에서 문장 글자 수(${cm.turnSteps}글자)만큼 시계를 한 시간씩 돌려 보니 ${cm.endHour12}시에 멈췄어요.`,
      },
      {
        label: '2',
        title: '날짜·상수 보정',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '메뉴 획수 일치',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: `시계가 가리킨 숫자 ${menuAnalysis.totalStrokes}${numJosa(menuAnalysis.totalStrokes, '에', '에')} 딱 맞는 메뉴는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `지금 ${cm.startHour12}시에서 ${cm.turnSteps}글자만큼 시계를 돌려 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나와요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      clockMetrics: cm,
    };
  }

  // 4. 실시간 날씨 (NEW — Open-Meteo 실제 현재 기온·습도·풍속 반영!)
  if (theoryId === 'weather') {
    const w = liveData.weather;
    const { label: skyLabel, icon } = describeWmoWeather(w.weatherCode);
    const roundedTemp = Math.round(w.tempC);
    const humDigitSum = digitSum(w.humidity);
    const isColdOrWet = w.tempC <= 12 || w.weatherCode >= 51;
    const isHot = w.tempC >= 24;
    const moodLabel = isColdOrWet ? '뜨끈한 한 끼' : isHot ? '시원한 한 끼' : '든든한 한 끼';

    const weatherTerms: InvariantTerm[] = [];
    if (roundedTemp > 0) {
      weatherTerms.push({
        name: `현재 기온(${roundedTemp}°)`,
        symbol: `현재 기온(${roundedTemp}°)`,
        value: roundedTemp,
        kind: 'method',
        naturalPhrase: `지금 바깥 기온이 ${roundedTemp}°라 ${roundedTemp}`,
      });
    } else if (roundedTemp < 0) {
      const absT = Math.abs(roundedTemp);
      weatherTerms.push({
        name: `영하 기온(${absT}°)`,
        symbol: `영하 기온(${absT}°)`,
        value: absT,
        kind: 'method',
        naturalPhrase: `지금 바깥이 영하 ${absT}°라 ${absT}`,
      });
    }
    if (humDigitSum > 0) {
      weatherTerms.push({
        name: `습도 자릿수(${humDigitSum})`,
        symbol: `습도 자릿수(${humDigitSum})`,
        value: humDigitSum,
        kind: 'method',
        naturalPhrase: `현재 습도(${w.humidity}%)의 자릿수를 더한 값(${humDigitSum})`,
      });
    }

    const bridge = solveBridge(weatherTerms);
    const tempDisplay = `${w.tempC}°`;

    const weatherMetrics: WeatherMetrics = {
      tempC: w.tempC,
      humidity: w.humidity,
      windKmh: w.windKmh,
      skyLabel,
      icon,
      moodLabel,
      isLive: w.isLive,
    };

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '실시간 날씨 측정',
        formula: `현재 기온 ${tempDisplay} · 습도 ${w.humidity}% · ${skyLabel}`,
        explanation: `지금 바깥의 실제 날씨(${skyLabel}, 풍속 ${w.windKmh}km/h) 데이터를 바로 불러왔어요.`,
      },
      {
        label: '2',
        title: '날씨 수치 대입',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '날씨 맞춤 메뉴',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: isColdOrWet
          ? `지금 바깥이 ${tempDisplay}라 속까지 뜨끈하게 데워 줄 ${menuCopula}.`
          : isHot
          ? `지금 바깥이 ${tempDisplay}라 깔끔하고 시원하게 먹기 좋은 ${menuCopula}.`
          : `지금 ${tempDisplay} 날씨에 딱 기분 좋게 어울리는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: isColdOrWet
        ? `지금 바깥이 ${tempDisplay}라 뜨끈한 ‘${menu.name}’${josa(menu.name, '이', '가')} 딱이에요.`
        : isHot
        ? `지금 바깥이 ${tempDisplay}라 시원한 ‘${menu.name}’${josa(menu.name, '이', '가')} 딱이에요.`
        : `지금 ${tempDisplay} ${skyLabel} 날씨와 문장을 합쳐 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나와요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      weatherMetrics,
    };
  }

  // 5. 실시간 환율 (NEW — Open ER-API 실제 원/달러 환율 스파크라인 반영!)
  if (theoryId === 'fx') {
    const { usdKrw, isLive } = liveData.fx;
    const digits = String(usdKrw).split('').map(Number);
    const fxDigitSum = digits.reduce((a, b) => a + b, 0);
    const fxTerm: InvariantTerm = {
      name: `환율 자릿수 합(${fxDigitSum})`,
      symbol: `환율 자릿수(${fxDigitSum})`,
      value: fxDigitSum,
      kind: 'method',
      naturalPhrase: `지금 환율(${usdKrw.toLocaleString()}원) 네 자리를 다 더한 값(${fxDigitSum})`,
    };
    const bridge = solveBridge([fxTerm]);

    // Build crisp deterministic 10-point sparkline curve anchored to real sentence + rate
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
      const syl = sentence.syllables[i % Math.max(1, sentence.syllables.length)];
      const wave = ((syl?.totalStrokes ?? 5) * 13 + usdKrw + i * 7) % 100;
      points.push(Number((0.18 + (wave / 100) * 0.68).toFixed(2)));
    }
    points[9] = 0.78;

    const fxMetrics: FxMetrics = {
      usdKrw,
      digits,
      digitSum: fxDigitSum,
      points,
      isLive,
    };

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '실시간 환율 분해',
        formula: `1달러 = ${usdKrw.toLocaleString()}원 → ${digits.join(' + ')} = ${fxDigitSum}`,
        explanation: `지금 실시간 원/달러 환율(${usdKrw.toLocaleString()}원)의 각 숫자를 더해 ${fxDigitSum}${numJosa(fxDigitSum, '을', '를')} 뽑았어요.`,
      },
      {
        label: '2',
        title: '환율 공식 적용',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '최종 메뉴 일치',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: `오늘 환율 지표와 문장이 맞물려 나온 메뉴는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `지금 원/달러 환율(${usdKrw.toLocaleString()}원)을 대입해 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나와요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      fxMetrics,
    };
  }

  // 6. 오늘 달 위상 (NEW — 실시간 천문 달 차오름 비율 & 음력 날짜!)
  if (theoryId === 'moon') {
    const m = liveData.moon;
    const pctDigitSum = digitSum(m.illuminationPct);
    const moonTerms: InvariantTerm[] = [
      {
        name: `음력(${m.lunarDay}일)`,
        symbol: `음력(${m.lunarDay}일)`,
        value: m.lunarDay,
        kind: 'method',
        naturalPhrase: `오늘이 음력 ${m.lunarDay}일차라 ${m.lunarDay}`,
      },
    ];
    if (pctDigitSum > 0) {
      moonTerms.push({
        name: `달 밝기 자릿수(${pctDigitSum})`,
        symbol: `달 밝기 자릿수(${pctDigitSum})`,
        value: pctDigitSum,
        kind: 'method',
        naturalPhrase: `오늘 달 밝기(${m.illuminationPct}%) 자릿수를 더한 값(${pctDigitSum})`,
      });
    }
    const bridge = solveBridge(moonTerms);

    const moonMetrics: MoonMetrics = {
      illuminationPct: m.illuminationPct,
      lunarDay: m.lunarDay,
      phaseRatio: m.phaseRatio,
      phaseName: m.phaseName,
    };

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '오늘 달 위상 계산',
        formula: `${m.phaseName} · 밝기 ${m.illuminationPct}% · 음력 ${m.lunarDay}일차`,
        explanation: `지금 이 시각 밤하늘의 달이 ${m.illuminationPct}% 밝기(${m.phaseName})로 떠 있어요.`,
      },
      {
        label: '2',
        title: '천문 주기 대입',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '메뉴 획수 일치',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: `오늘 밤 ${m.phaseName}이 가리키는 메뉴는 딱 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `오늘 밤 ${m.phaseName}(${m.illuminationPct}%) 주기에 문장을 맞춰 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나와요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      moonMetrics,
    };
  }

  // 4. 획수 계산
  if (theoryId === 'numerology') {
    const bridge = solveBridge();
    const steps: ProofStep[] = [
      {
        label: '1',
        title: '획수 세어보기',
        formula: `${sentence.charCount}글자 · 자음 ${sentence.consonantCount}개 · 모음 ${sentence.vowelCount}개 = 총 ${sentence.totalStrokes}획`,
        explanation: '방금 적으신 글자들의 한글 획수를 하나씩 전부 세어 봤어요.',
      },
      {
        label: '2',
        title: '오늘 날짜·상수 대입',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '메뉴 획수 일치',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: `획수가 딱 ${menuAnalysis.totalStrokes}획으로 떨어지는 메뉴는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `글자 획수를 계산해 보니 딱 ${menuAnalysis.totalStrokes}획, ${menuCopula}.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
    };
  }

  // 5. 키보드 동선 (진짜로 가장 가까운 무게중심 메뉴!)
  if (theoryId === 'keyboard') {
    const distMeters = (sentence.travelDistanceMm / 1000).toFixed(2);
    const distCm = (sentence.travelDistanceMm / 10).toFixed(1);
    const travelLabel = sentence.travelDistanceMm >= 1000 ? `${distMeters}m` : `${distCm}cm`;
    const distBetweenCentroids = Math.hypot(
      sentence.centroidMm.x - menuAnalysis.centroidMm.x,
      sentence.centroidMm.y - menuAnalysis.centroidMm.y
    ).toFixed(1);
    const bridge = solveBridge();

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '손가락 이동 거리',
        formula: `키보드 ${sentence.keystrokes.length}번 타자 · 총 이동 거리 ${travelLabel}`,
        explanation: `방금 문장을 치느라 손가락이 자판 위를 ${travelLabel}나 오갔어요.`,
      },
      {
        label: '2',
        title: '가장 가까운 메뉴 좌표',
        formula: `내 무게중심 (${sentence.centroidMm.x}, ${sentence.centroidMm.y})mm ↔ ‘${menu.name}’ 거리 ${distBetweenCentroids}mm`,
        explanation: `모든 후보 메뉴 중 자판 위 손가락 중심이 ‘${menu.name}’ 위치와 불과 ${distBetweenCentroids}mm 차이로 가장 가까워요.`,
      },
      {
        label: '3',
        title: '획수까지 검증',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `방금 타자 친 손가락 중심이 자판 위 ‘${menu.name}’${josa(menu.name, '과', '와')} 불과 ${distBetweenCentroids}mm 차이예요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
    };
  }

  // 6. 글자 별자리
  if (theoryId === 'constellation') {
    const sampleSyls = sentence.syllables.slice(0, 8);
    const maxSt = Math.max(4, ...sampleSyls.map((s) => s.totalStrokes));
    const minSt = Math.min(...sampleSyls.map((s) => s.totalStrokes));
    const range = Math.max(1, maxSt - minSt);

    const stars: ConstellationStar[] = sampleSyls.map((s, idx) => {
      const x = sampleSyls.length <= 1 ? 50 : 12 + (idx / (sampleSyls.length - 1)) * 76;
      const y = 78 - ((s.totalStrokes - minSt) / range) * 56;
      return {
        char: s.char,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        strokes: s.totalStrokes,
      };
    });

    const first = stars[0] ?? { x: 15, y: 50 };
    const last = stars[stars.length - 1] ?? { x: 85, y: 50 };
    const apexAngleDeg = Math.round(
      Math.abs((Math.atan2(last.y - first.y, last.x - first.x) * 180) / Math.PI)
    );
    const constellationName = `${menu.name}자리`;
    const starCountTerm: InvariantTerm = {
      name: `별 개수(${stars.length}개)`,
      symbol: `별 개수(${stars.length}개)`,
      value: stars.length,
      kind: 'method',
      naturalPhrase: `하늘에 찍힌 별(${stars.length}개)`,
    };
    const bridge = solveBridge([starCountTerm]);

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '글자 좌표 찍기',
        formula: stars.slice(0, 4).map((st, i) => `${st.char}(${i + 1}, ${st.strokes})`).join(' → '),
        explanation: `글자 순서와 획수를 밤하늘 좌표로 찍어 별 ${stars.length}개를 선으로 이었어요.`,
      },
      {
        label: '2',
        title: '별자리 밝기 계산',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '별자리 판독 완료',
        formula: `기울기 ${apexAngleDeg}° · 고유 밝기 ${menuAnalysis.totalStrokes}등급 = ${constellationName}`,
        explanation: `좌표를 다 이어 보니 밤하늘에 영락없는 ‘${constellationName}’가 떠 있네요.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `글자들을 좌표로 이어 보니 밤하늘에 ‘${constellationName}’가 그려졌어요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      constellation: {
        stars,
        apexAngleDeg,
        constellationName,
      },
    };
  }

  // 7. 받침 리듬파 (실제 받침 비율이 가장 닮은 메뉴 매칭!)
  if (theoryId === 'morse') {
    const sampleSyls = sentence.syllables.slice(0, 12);
    const beats: MorseBeat[] = sampleSyls.map((s) => ({
      char: s.char,
      isLong: s.jong !== '',
      amplitude: Math.min(1, 0.32 + (s.totalStrokes / Math.max(6, sentence.maxStrokes)) * 0.68),
    }));
    const patternText = beats.map((b) => (b.isLong ? '—' : '·')).join(' ');
    const menuPatternText = menuAnalysis.syllables
      .map((s) => `${s.char}(${s.jong ? '—' : '·'})`)
      .join(' ');
    const sentPct = Math.round((sentence.batchimCount / Math.max(1, sentence.charCount)) * 100);
    const menuPct = Math.round(
      (menuAnalysis.batchimCount / Math.max(1, menuAnalysis.charCount)) * 100
    );
    const bpm = 96 + (sentence.totalStrokes % 48);
    const batchimTerm: InvariantTerm = {
      name: `긴 음 받침(${sentence.batchimCount}개)`,
      symbol: `받침(${sentence.batchimCount}개)`,
      value: sentence.batchimCount,
      kind: 'method',
      naturalPhrase: `문장의 긴 음 받침(${sentence.batchimCount}개)`,
    };
    const bridge = solveBridge(sentence.batchimCount > 0 ? [batchimTerm] : []);

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '받침 리듬 추출',
        formula: `${patternText}  (받침 비율 ${sentPct}%)`,
        explanation: `받침 있는 글자(${sentence.batchimCount}개)는 긴 음(—), 없는 글자는 짧은 음(·)으로 바꿨어요.`,
      },
      {
        label: '2',
        title: '공명 숫자 계산',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '닮은 리듬 메뉴',
        formula: `${menuPatternText}  (받침 비율 ${menuPct}%)`,
        explanation: `문장 박자(${sentPct}%)와 ‘${menu.name}’의 받침 리듬(${menuPct}%)이 가장 비슷하게 겹쳐요.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `문장의 받침 박자(${sentPct}%)가 ‘${menu.name}’의 리듬(${menuPct}%)과 가장 닮았어요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      morse: {
        beats,
        patternText,
        menuPatternText,
        bpm,
      },
    };
  }

  // 8. 유니코드 (실제 코드 자릿수 합을 Step 2에 직접 연결!)
  if (theoryId === 'unicode') {
    const sumHex = `0x${sentence.utf16Sum.toString(16).toUpperCase()}`;
    const xorHex = `0x${sentence.utf16Xor.toString(16).toUpperCase().padStart(4, '0')}`;
    const factorsText = factorizeSmallInt(sentence.utf16Sum);
    const codeDigitSum = digitSum(sentence.utf16Sum);
    const modBase = menuAnalysis.totalStrokes;
    const rem = sentence.utf16Sum % modBase;
    const digitSumTerm: InvariantTerm = {
      name: `코드 자릿수 합(${codeDigitSum})`,
      symbol: `코드 자릿수 합(${codeDigitSum})`,
      value: codeDigitSum,
      kind: 'method',
      naturalPhrase: `유니코드 합계의 자릿수를 다 더한 값(${codeDigitSum})`,
    };
    const bridge = solveBridge([digitSumTerm]);

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '글자 코드 합산',
        formula: `${sentence.utf16Sum.toLocaleString()} (${sumHex}) → 자릿수 합 ${codeDigitSum}`,
        explanation: `컴퓨터가 저장하는 글자 코드를 모두 더해 자릿수를 합치니 ${codeDigitSum}${numJosa(codeDigitSum, '이', '가')} 나왔어요.`,
      },
      {
        label: '2',
        title: '고유 숫자 맞추기',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '고유 숫자 일치',
        formula: `${menuStrokeBreakdown} = ${modBase}`,
        explanation: `코드 계산 끝에 나온 숫자 ${modBase}에 딱 맞는 메뉴는 ${menuCopula}.`,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: `문장의 유니코드 합(${sumHex})을 풀어 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나와요.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      unicodeFactors: {
        sumHex,
        xorHex,
        primeFactorsText: factorsText,
        digitSum: codeDigitSum,
        modulus: modBase,
        remainder: rem,
      },
    };
  }

  // 9. 말투 온도 (진짜 메뉴 온도 성향 매칭!)
  if (theoryId === 'thermodynamics') {
    const totalV = Math.max(1, sentence.vowelCount);
    const yangPct = Math.round((sentence.yangVowelCount / totalV) * 100);
    const yinPct = Math.round((sentence.yinVowelCount / totalV) * 100);
    const excitationPct = computeThermoExcitation(sentence);
    const entropyVal = Number(
      ((sentence.totalStrokes * 1.38 + sentence.harshCount * 4.2) / Math.max(1, sentence.wordCount)).toFixed(1)
    );
    const bridge = solveBridge();

    const isHotVoice = excitationPct >= 52;
    const profile = menu.tempProfile ?? 'warm';
    const matchStory =
      isHotVoice && profile === 'cool'
        ? `말투 열기(${excitationPct}°)가 꽤 높아서 산뜻하게 식혀 줄 ${menuCopula}.`
        : isHotVoice
        ? `말투 열기(${excitationPct}°)가 높아서 이열치열로 딱 어울리는 뜨거운 ${menuCopula}.`
        : `지금 차분한 말투 온도(${excitationPct}°)를 기분 좋게 데워 줄 ${menuCopula}.`;

    const steps: ProofStep[] = [
      {
        label: '1',
        title: '발음 온도 측정',
        formula: `말투 온도 ${excitationPct}° · 밝은 모음 ${yangPct}% · 어두운 모음 ${yinPct}%`,
        explanation: `강한 자음(${sentence.harshCount}개)과 모음 비율로 지금 말투의 온도를 쟀어요.`,
      },
      {
        label: '2',
        title: '온도 균형 공식',
        formula: bridge.expression,
        explanation: bridge.stepsExplanation,
      },
      {
        label: '3',
        title: '딱 맞는 메뉴',
        formula: `${menuStrokeBreakdown} = ${menuAnalysis.totalStrokes}획`,
        explanation: matchStory,
      },
    ];

    return {
      proofId,
      theory,
      sentence,
      menu,
      menuAnalysis,
      confidencePct,
      theoremTitle: isHotVoice && profile === 'cool'
        ? `지금 말투가 ${excitationPct}°라 열기를 식혀 줄 ${menuSubject} 딱이에요.`
        : `지금 말투 온도(${excitationPct}°)에 딱 어울리는 메뉴는 ${menuCopula}.`,
      bridgeExpression: bridge.expression,
      steps,
      qedLine: `오늘은 ${menuCopula}`,
      thermoMetrics: {
        excitationPct,
        yangPct,
        yinPct,
        entropyval: entropyVal,
        requiredCounterBalance: '',
      },
    };
  }

  // 10. 원소 조합 (실제 원자번호 합을 Step 2에 직접 연결!)
  const words = sentence.trimmed.split(/\s+/).filter(Boolean);
  const chunks =
    words.length >= 2
      ? words.slice(0, 4)
      : sentence.syllables.slice(0, 4).map((s) => s.char);

  const periodicTerms: PeriodicTerm[] = chunks.map((chunk) => {
    const ca = analyzeSentence(chunk);
    let bestEl = ELEMENTS[0];
    let bestDiff = Infinity;
    for (const el of ELEMENTS) {
      const d = Math.abs(el.z - ca.totalStrokes);
      if (d < bestDiff) {
        bestDiff = d;
        bestEl = el;
      }
    }
    return {
      symbol: bestEl.sym,
      korName: bestEl.kor,
      atomicNumber: bestEl.z,
      sourceChunk: chunk,
    };
  });

  const atomicSum = periodicTerms.reduce((acc, t) => acc + t.atomicNumber, 0);
  const chemFormulaLeft = periodicTerms
    .map((t) => `${t.symbol}(${t.atomicNumber})`)
    .join(' + ');
  const atomicTerm: InvariantTerm = {
    name: `원자번호 합(${atomicSum})`,
    symbol: `원자번호 합(${atomicSum})`,
    value: atomicSum,
    kind: 'method',
    naturalPhrase: `추출된 원소들의 원자번호 합(${atomicSum})`,
  };
  const bridge = solveBridge([atomicTerm]);

  const steps: ProofStep[] = [
    {
      label: '1',
      title: '단어를 원소로 변환',
      formula: `${chemFormulaLeft} = ${atomicSum}`,
      explanation: `각 단어 획수에 가장 가까운 주기율표 원소(${periodicTerms.map((t) => `${t.korName} ${t.symbol}`).join(', ')})를 뽑았어요.`,
    },
    {
      label: '2',
      title: '원자량 맞추기',
      formula: bridge.expression,
      explanation: bridge.stepsExplanation,
    },
    {
      label: '3',
      title: '최종 결과물',
      formula: `${chemFormulaLeft} → ${menu.name} (${menuAnalysis.totalStrokes}획)`,
      explanation: `이 원소들을 반응시켜 나오는 메뉴는 딱 ${menuCopula}.`,
    },
  ];

  return {
    proofId,
    theory,
    sentence,
    menu,
    menuAnalysis,
    confidencePct,
    theoremTitle: `단어들을 주기율표 원소로 합쳐 보니 ‘${menu.name}’${josa(menu.name, '이', '가')} 나왔어요.`,
    bridgeExpression: bridge.expression,
    steps,
    qedLine: `오늘은 ${menuCopula}`,
    periodicTerms,
  };
}
