import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { LiveWorldData, MenuItem, ProofResult, TheoryId } from '../types/menu';
import { analyzeSentence } from '../engine/hangulMath';
import {
  playReelTickSound,
  playScanTickSound,
  playVerifyTickSound,
} from '../engine/soundEngine';

export interface CinemaTimingPlan {
  act1Ms: number;
  act2Ms: number;
  act3SweepMs: number;
  act3LockHoldMs: number;
  act3Ms: number;
  totalMs: number;
  waveCount: number;
}

/**
 * Compute an organic, workload-proportional timing plan (always ~5.0s–6.85s)
 * based on input sentence length/strokes, formula complexity, and active candidate count.
 */
export function computeCinemaTiming(
  text: string,
  theoryId: TheoryId,
  activeMenuCount: number,
  jitterSeed = Math.random()
): CinemaTimingPlan {
  const analysis = analyzeSentence(text);
  const chars = Math.min(24, analysis.charCount);
  const strokes = Math.min(130, analysis.totalStrokes);

  // Deterministic-feeling micro jitter split into 3 independent offsets in [-1, 1]
  const j1 = Math.sin(jitterSeed * 91.7 + 1.3);
  const j2 = Math.sin(jitterSeed * 157.3 + 2.9);
  const j3 = Math.sin(jitterSeed * 223.1 + 4.7);

  // Act 1: Scales with syllable count & stroke density (1140..1720ms)
  const act1Raw = 1160 + chars * 22 + strokes * 1.6 + j1 * 110;
  const act1Ms = Math.round(Math.max(1140, Math.min(1720, act1Raw)));

  // Act 2: Scales with theory complexity (live feeds / multi-step astronomy / periodic) (1200..1740ms)
  const heavyTheoryBonus =
    theoryId === 'weather' || theoryId === 'fx' || theoryId === 'moon' || theoryId === 'periodic'
      ? 140
      : theoryId === 'constellation' || theoryId === 'keyboard' || theoryId === 'unicode'
      ? 80
      : 0;
  const act2Raw = 1260 + heavyTheoryBonus + Math.min(160, analysis.wordCount * 28) + j2 * 130;
  const act2Ms = Math.round(Math.max(1180, Math.min(1740, act2Raw)));

  // Act 3: Scales with active menu pool size (fewer menus -> brisker, 500 menus -> richer culling)
  const poolFactor = Math.min(1, Math.log10(Math.max(10, activeMenuCount)) / Math.log10(500));
  const waveCount = Math.max(
    7,
    Math.min(11, Math.round(6.8 + poolFactor * 3.1 + (j3 > 0.35 ? 1 : j3 < -0.55 ? -1 : 0)))
  );
  const sweepRaw = 1520 + poolFactor * 540 + (waveCount - 8) * 95 + j3 * 130;
  const act3SweepMs = Math.round(Math.max(1550, Math.min(2380, sweepRaw)));
  const act3LockHoldMs = Math.round(980 + Math.abs(j1) * 160); // 980..1140ms crisp hold

  let act3Ms = act3SweepMs + act3LockHoldMs;
  let totalMs = act1Ms + act2Ms + act3Ms;

  // Guarantee > 5.05s minimum and <= 6.85s cap so every run feels alive without ever dragging
  if (totalMs < 5060) {
    const pad = 5060 - totalMs + Math.round(Math.abs(j2) * 180);
    act3Ms += pad;
    totalMs += pad;
  } else if (totalMs > 6850) {
    const trim = totalMs - 6850;
    act3Ms = Math.max(2450, act3Ms - trim);
    totalMs = act1Ms + act2Ms + act3Ms;
  }

  return {
    act1Ms,
    act2Ms,
    act3SweepMs: Math.min(act3SweepMs, act3Ms - 920),
    act3LockHoldMs: act3Ms - Math.min(act3SweepMs, act3Ms - 920),
    act3Ms,
    totalMs,
    waveCount,
  };
}

interface DeductionCinemaBarProps {
  proof: ProofResult;
  phase: 1 | 2 | 3 | 4;
  runKey: number;
  menus: MenuItem[];
  liveData: LiveWorldData;
  timing: CinemaTimingPlan;
  soundOn: boolean;
  onSkip: () => void;
}

interface FormulaToken {
  text: string;
  kind: 'operand' | 'op' | 'result';
}

interface ReelCandidate {
  name: string;
  category: string;
  strokes: number;
  rejectReason: string;
  isWinner: boolean;
}

function tokenizeBridgeFormula(expr: string): FormulaToken[] {
  const formatted = expr
    .replace(/\(([^()]+)\)/g, (_, inner: string) =>
      /[+\-−×÷=]/.test(inner) ? inner : ` ${inner}`
    )
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = formatted.split(/\s+([+\-−×÷=])\s+/).filter(Boolean);
  const tokens: FormulaToken[] = [];
  let sawEquals = false;

  for (const part of parts) {
    if (/^[+\-−×÷=]$/.test(part)) {
      if (part === '=') sawEquals = true;
      tokens.push({ text: part, kind: 'op' });
    } else if (sawEquals) {
      tokens.push({ text: part, kind: 'result' });
    } else {
      tokens.push({ text: part, kind: 'operand' });
    }
  }
  return tokens;
}

function getSecondaryRejectReason(theoryId: TheoryId): string {
  switch (theoryId) {
    case 'conspiracy':
      return '초성 불일치';
    case 'fingerprint':
      return '자모 일치율 부족';
    case 'keyboard':
      return '자판 좌표 오차';
    case 'morse':
      return '받침 리듬 불일치';
    case 'weather':
    case 'thermodynamics':
      return '온도 성향 오차';
    case 'clock':
      return '시계 각도 오차';
    case 'fx':
      return '환율 수치 오차';
    case 'moon':
      return '달 위상 오차';
    default:
      return '세부 조건 미달';
  }
}

function buildRejectReason(
  candidateStrokes: number,
  targetStrokes: number,
  theoryId: TheoryId
): string {
  const diff = candidateStrokes - targetStrokes;
  if (diff > 0) return `+${diff}획 초과`;
  if (diff < 0) return `${diff}획 부족`;
  return getSecondaryRejectReason(theoryId);
}

const MATRIX_DOT_COUNT = 40; // 10 x 4 precision candidate grid

/**
 * Generate smooth decelerating wave timestamps across [0, sweepMs].
 */
function buildDeceleratingDelays(steps: number, sweepMs: number): number[] {
  if (steps <= 1) return [0];
  const delays: number[] = [];
  for (let i = 0; i < steps; i++) {
    const progress = i / (steps - 1);
    delays.push(Math.round(Math.pow(progress, 1.55) * sweepMs));
  }
  return delays;
}

function buildSurvivorCurve(total: number, steps: number): number[] {
  const safeTotal = Math.max(1, total);
  if (steps <= 1) return [1];
  const curve: number[] = [];
  for (let i = 0; i < steps; i++) {
    if (i === 0) {
      curve.push(safeTotal);
    } else if (i === steps - 1) {
      curve.push(1);
    } else {
      const t = i / (steps - 1);
      // Exponential culling curve that drops sharply then narrows into the final few candidates
      const ratio = Math.pow(1 - t, 2.85);
      const prev = curve[i - 1];
      const raw = Math.max(2, Math.round(safeTotal * ratio));
      curve.push(Math.min(Math.max(1, prev - 1), raw));
    }
  }
  return curve;
}

function buildDotSurvivalOrder(seed: number): number[] {
  const arr = Array.from({ length: MATRIX_DOT_COUNT }, (_, i) => i);
  let s = (seed * 9301 + 49297) % 233280;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getEliminationStageLabel(reelIdx: number, lastIdx: number): string {
  if (reelIdx >= lastIdx) return '유일 후보 확정';
  const ratio = reelIdx / Math.max(1, lastIdx);
  if (ratio <= 0.32) return '1차 조건 미달 제외';
  if (ratio <= 0.68) return '2차 획수 오차 기각';
  return '3차 최종 후보 압축';
}

export const DeductionCinemaBar: React.FC<DeductionCinemaBarProps> = ({
  proof,
  phase,
  runKey,
  menus,
  liveData,
  timing,
  soundOn,
  onSkip,
}) => {
  const formulaTokens = useMemo(
    () => tokenizeBridgeFormula(proof.bridgeExpression),
    [proof.bridgeExpression]
  );

  const activeMenuCount = useMemo(() => menus.filter((m) => m.enabled).length, [menus]);

  // Display up to 12 syllables in Act 1 live dissector
  const scanSyllables = useMemo(
    () => proof.sentence.syllables.slice(0, 12),
    [proof.sentence.syllables]
  );

  // Build dynamic decoy candidates + final winning menu scaled to timing.waveCount
  const reelItems = useMemo<ReelCandidate[]>(() => {
    const enabled = menus.filter((m) => m.enabled && m.name !== proof.menu.name);
    const seed = proof.sentence.utf16Sum + runKey * 37;
    const targetStrokes = proof.menuAnalysis.totalStrokes;
    const decoyTarget = Math.max(2, timing.waveCount - 1);
    const picked: ReelCandidate[] = [];
    const used = new Set<string>();

    for (let i = 0; i < decoyTarget && enabled.length > 0; i++) {
      const idx = (seed + i * 47) % enabled.length;
      const item = enabled[idx];
      if (!used.has(item.name)) {
        used.add(item.name);
        const st = analyzeSentence(item.name).totalStrokes;
        picked.push({
          name: item.name,
          category: item.category,
          strokes: st,
          rejectReason: buildRejectReason(st, targetStrokes, proof.theory.id),
          isWinner: false,
        });
      }
    }

    picked.push({
      name: proof.menu.name,
      category: proof.menu.category,
      strokes: targetStrokes,
      rejectReason: '정확 일치',
      isWinner: true,
    });
    return picked;
  }, [
    menus,
    proof.menu.name,
    proof.menu.category,
    proof.menuAnalysis.totalStrokes,
    proof.sentence.utf16Sum,
    proof.theory.id,
    timing.waveCount,
    runKey,
  ]);

  const survivorCurve = useMemo(
    () => buildSurvivorCurve(activeMenuCount, reelItems.length),
    [activeMenuCount, reelItems.length]
  );

  const dotRankMap = useMemo(() => {
    const order = buildDotSurvivalOrder(proof.sentence.utf16Sum + runKey * 19);
    const ranks = new Array<number>(MATRIX_DOT_COUNT).fill(0);
    order.forEach((dotIndex, rank) => {
      ranks[dotIndex] = rank;
    });
    return ranks;
  }, [proof.sentence.utf16Sum, runKey]);

  const spectrumBars = useMemo(() => {
    const count = 14;
    const peakIdx = Math.max(
      2,
      Math.min(count - 3, (proof.menuAnalysis.totalStrokes % (count - 4)) + 2)
    );
    return Array.from({ length: count }, (_, i) => {
      const dist = Math.abs(i - peakIdx);
      const height =
        dist === 0
          ? 1
          : dist === 1
          ? 0.72
          : dist === 2
          ? 0.46
          : Math.max(0.18, 0.34 - dist * 0.03 + ((proof.sentence.utf16Sum + i * 7) % 12) / 100);
      return { height: Number(height.toFixed(2)), isPeak: dist === 0, isNear: dist <= 1 };
    });
  }, [proof.menuAnalysis.totalStrokes, proof.sentence.utf16Sum]);

  const [scanIdx, setScanIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [verifiedStep, setVerifiedStep] = useState(0);
  const [act2TargetNum, setAct2TargetNum] = useState(0);
  const [reelIdx, setReelIdx] = useState(0);

  // Live precision elapsed stopwatch while cinema is active (Acts 1-3)
  useEffect(() => {
    if (phase === 4) return;
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setElapsedSec((now - start) / 1000);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [runKey, phase === 4]);

  // Act 1 live syllable-by-syllable scanner sweep paced dynamically to timing.act1Ms
  useEffect(() => {
    if (phase !== 1) return;
    setScanIdx(0);
    const total = Math.max(1, scanSyllables.length);
    const sweepWindow = Math.max(500, Math.round(timing.act1Ms * 0.82));
    const stepMs = Math.max(65, Math.min(180, Math.floor(sweepWindow / total)));
    const timers: number[] = [];

    for (let i = 1; i < total; i++) {
      timers.push(
        window.setTimeout(() => {
          setScanIdx(i);
          if (i % 2 === 1) playScanTickSound(i, soundOn);
        }, i * stepMs)
      );
    }

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, runKey, scanSyllables.length, timing.act1Ms, soundOn]);

  // Act 2 staggered verification checkmarks + convergence readout scaled to timing.act2Ms
  useEffect(() => {
    if (phase < 2) {
      setVerifiedStep(0);
      setAct2TargetNum(0);
      return;
    }
    if (phase >= 3) {
      setVerifiedStep(3);
      setAct2TargetNum(proof.menuAnalysis.totalStrokes);
      return;
    }

    const checkDelays = [
      Math.round(timing.act2Ms * 0.11),
      Math.round(timing.act2Ms * 0.39),
      Math.round(timing.act2Ms * 0.68),
    ];
    const timers = checkDelays.map((delay, idx) =>
      window.setTimeout(() => {
        setVerifiedStep(idx + 1);
        playVerifyTickSound(idx, soundOn);
      }, delay)
    );

    let rafId = 0;
    const start = performance.now();
    const target = proof.menuAnalysis.totalStrokes;
    const countDuration = Math.max(600, Math.round(timing.act2Ms * 0.66));
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / countDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAct2TargetNum(Math.max(1, Math.round(target * eased)));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(rafId);
    };
  }, [phase, runKey, proof.menuAnalysis.totalStrokes, timing.act2Ms, soundOn]);

  // Act 3 decelerating elimination waves scaled to timing.act3SweepMs
  useEffect(() => {
    if (phase !== 3) {
      setReelIdx(0);
      return;
    }

    const timers: number[] = [];
    const lastIdx = reelItems.length - 1;
    const waveDelays = buildDeceleratingDelays(reelItems.length, timing.act3SweepMs);

    waveDelays.forEach((delay, step) => {
      const targetIdx = Math.min(step, lastIdx);
      const isFinal = targetIdx === lastIdx;
      const id = window.setTimeout(() => {
        setReelIdx(targetIdx);
        playReelTickSound(step, isFinal, soundOn);
      }, delay);
      timers.push(id);
    });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, runKey, reelItems.length, timing.act3SweepMs, soundOn]);

  if (phase === 4) return null;

  const activeSyl = scanSyllables[Math.min(scanIdx, scanSyllables.length - 1)];
  const scannedStrokesSoFar = scanSyllables
    .slice(0, scanIdx + 1)
    .reduce((acc, s) => acc + s.totalStrokes, 0);
  const maxSylStroke = Math.max(4, ...scanSyllables.map((s) => s.totalStrokes));

  const lastReelIdx = reelItems.length - 1;
  const currentCandidate = reelItems[Math.min(reelIdx, lastReelIdx)];
  const isLocked = phase === 3 && currentCandidate?.isWinner;
  const remainingCount = survivorCurve[Math.min(reelIdx, survivorCurve.length - 1)] ?? 1;
  const prevRemainingCount =
    reelIdx > 0 ? survivorCurve[Math.min(reelIdx - 1, survivorCurve.length - 1)] : activeMenuCount;
  const droppedThisWave = Math.max(0, prevRemainingCount - remainingCount);

  const litDotLimit = isLocked
    ? 1
    : Math.max(2, Math.ceil((remainingCount / Math.max(1, activeMenuCount)) * MATRIX_DOT_COUNT));
  const prevLitDotLimit =
    reelIdx === 0
      ? MATRIX_DOT_COUNT
      : Math.max(
          2,
          Math.ceil((prevRemainingCount / Math.max(1, activeMenuCount)) * MATRIX_DOT_COUNT)
        );

  const recentRejected =
    phase === 3 && reelIdx > 0
      ? reelItems.slice(Math.max(0, reelIdx - 2), reelIdx).reverse()
      : [];

  const barRatio = isLocked
    ? 1
    : Math.max(0.03, remainingCount / Math.max(1, activeMenuCount));

  const actLabels = ['정밀 채취', '교차 연산', '후보 소거'];
  const verifyLabels = [
    '음절·자모 분해',
    '실시간 변수 결합',
    `목표치 ${proof.menuAnalysis.totalStrokes}획 수렴`,
  ];

  const activeJamoLabel = activeSyl
    ? activeSyl.isHangul
      ? [activeSyl.cho, activeSyl.jung, activeSyl.jong].filter(Boolean).join(' · ')
      : activeSyl.char
    : '';

  const cinemaStyle = {
    '--act1-ms': `${timing.act1Ms}ms`,
    '--act2-ms': `${timing.act2Ms}ms`,
    '--act3-ms': `${timing.act3Ms}ms`,
  } as React.CSSProperties;

  return (
    <div className="cinema-panel" style={cinemaStyle} aria-live="off">
      {/* Sleek 3-Act Hairline Progress Header + Elapsed Timer + Instant Skip */}
      <div className="cinema-top">
        <div className="cinema-progress-group">
          {actLabels.map((label, i) => {
            const stepNum = i + 1;
            const state =
              phase > stepNum ? 'done' : phase === stepNum ? 'active' : 'pending';
            return (
              <div key={label} className={`cinema-seg cinema-seg--${state}`}>
                <div className="cinema-seg-bar">
                  <div className="cinema-seg-fill" />
                </div>
                <span className="cinema-seg-label">{label}</span>
              </div>
            );
          })}
        </div>

        <span className="tabular cinema-timer">{elapsedSec.toFixed(2)}s</span>

        <button type="button" className="cinema-skip-btn" onClick={onSkip}>
          건너뛰기
        </button>
      </div>

      {/* ACT 1: Live Syllable-by-Syllable Dissection Scanner + Telemetry Matrix */}
      {phase === 1 && (
        <div className="telemetry-card" key={`tel-${runKey}`}>
          <div className="telemetry-head">
            <span className="telemetry-title">
              <span className="telemetry-live-dot" aria-hidden="true" />
              실시간 음절 · 변수 계측
            </span>
            {activeSyl && (
              <span className="tabular telemetry-inspector">
                ‘{activeSyl.char}’ → {activeJamoLabel} · {activeSyl.totalStrokes}획 · {activeSyl.hex}
              </span>
            )}
          </div>

          <div className="scan-strip" aria-hidden="true">
            {scanSyllables.map((syl, idx) => {
              const isCurrent = idx === scanIdx;
              const isDone = idx < scanIdx;
              const barScale = Math.max(0.22, syl.totalStrokes / maxSylStroke);
              return (
                <div
                  key={`${syl.index}-${syl.char}`}
                  className={`scan-unit ${
                    isCurrent ? 'is-current' : isDone ? 'is-done' : ''
                  }`}
                >
                  <span className="scan-char">{syl.char}</span>
                  <div className="scan-bar-track">
                    <div
                      className="scan-bar-fill"
                      style={{
                        transform: `scaleY(${isCurrent || isDone ? barScale : 0.14})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="telemetry-grid">
            <div className="telemetry-cell">
              <span className="telemetry-k">누적 획수</span>
              <span className="tabular telemetry-v">
                {scannedStrokesSoFar} / {proof.sentence.totalStrokes}획
              </span>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-k">기온 · 환율</span>
              <span className="tabular telemetry-v">
                {liveData.weather.tempC.toFixed(1)}° · {liveData.fx.usdKrw.toLocaleString()}원
              </span>
            </div>
            <div className="telemetry-cell">
              <span className="telemetry-k">음력 · 표본</span>
              <span className="tabular telemetry-v">
                달 {liveData.moon.illuminationPct}% · {activeMenuCount}개
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ACT 2: Full Kinetic Formula Assembly + Live Convergence Spectrum */}
      {phase === 2 && (
        <div className="eq-ribbon" key={`eq-${runKey}`}>
          <div className="eq-ribbon-head">
            <span>교차 공식 연산</span>
            <span className="tabular eq-target-hint">목표치 {act2TargetNum}획 수렴</span>
          </div>

          <div className="eq-pills">
            {formulaTokens.map((tok, idx) => (
              <span
                key={`${idx}-${tok.text}`}
                className={`eq-token eq-token--${tok.kind} motion-pop-in`}
                style={{ animationDelay: `${idx * 120}ms` }}
              >
                {tok.text}
              </span>
            ))}
          </div>

          <div className="eq-spectrum" aria-hidden="true">
            {spectrumBars.map((bar, idx) => (
              <div key={idx} className="eq-spec-slot">
                <div
                  className={`eq-spec-bar ${
                    bar.isPeak ? 'is-peak' : bar.isNear ? 'is-near' : ''
                  }`}
                  style={{
                    transform: `scaleY(${verifiedStep >= 2 ? bar.height : 0.25})`,
                    transitionDelay: `${idx * 18}ms`,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="eq-checks">
            {verifyLabels.map((label, idx) => {
              const done = verifiedStep >= idx + 1;
              return (
                <span key={label} className={`eq-check-item ${done ? 'is-done' : ''}`}>
                  <Check size={11} strokeWidth={2.8} aria-hidden="true" />
                  <span>{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ACT 3: Compact Verified Formula + 40-Node Rejection Matrix & Live Culled Feed */}
      {phase === 3 && currentCandidate && (
        <>
          <div className="eq-compact-strip">
            <span className="eq-compact-badge">
              <Check size={11} strokeWidth={3} aria-hidden="true" />
              공식 확정
            </span>
            <span className="tabular eq-compact-expr">{proof.bridgeExpression}</span>
          </div>

          <div className={`reel-card ${isLocked ? 'reel-card--locked' : ''}`}>
            <div className="reel-header-row">
              <div className="reel-left">
                <span className="reel-badge">
                  {getEliminationStageLabel(reelIdx, lastReelIdx)}
                </span>
                <span className="tabular reel-rule">
                  {isLocked
                    ? `${activeMenuCount}개 중 ${activeMenuCount - 1}개 기각 · 유일 일치`
                    : `${proof.menuAnalysis.totalStrokes}획 기준 전수 대조 중`}
                </span>
              </div>

              <div className="elim-counter-wrap">
                {droppedThisWave > 0 && !isLocked && (
                  <span key={`drop-${reelIdx}`} className="tabular elim-drop-pill">
                    −{droppedThisWave} 기각
                  </span>
                )}
                {isLocked && (
                  <span className="elim-pass-pill">
                    <Check size={10} strokeWidth={3} aria-hidden="true" />
                    최종 생존
                  </span>
                )}
                <div className="elim-counter">
                  <span className="tabular elim-count-num">{remainingCount}</span>
                  <span className="elim-count-unit">/ {activeMenuCount}</span>
                </div>
              </div>
            </div>

            <div className="elim-matrix" aria-hidden="true">
              {dotRankMap.map((rank, dotIdx) => {
                const isFinalDot = rank === 0;
                const isAlive = rank < litDotLimit;
                const isJustRejected =
                  reelIdx > 0 && rank >= litDotLimit && rank < prevLitDotLimit;
                const dotState =
                  isLocked && isFinalDot
                    ? 'is-winner'
                    : isAlive
                    ? 'is-alive'
                    : isJustRejected
                    ? 'is-rejecting'
                    : 'is-gone';
                return (
                  <span
                    key={`${dotIdx}-${isJustRejected ? reelIdx : 0}`}
                    className={`elim-dot ${dotState}`}
                  />
                );
              })}
            </div>

            <div className="elim-rail" aria-hidden="true">
              <div
                className={`elim-rail-fill ${isLocked ? 'is-locked' : ''}`}
                style={{ transform: `scaleX(${barRatio})` }}
              />
            </div>

            <div className="elim-stage-foot">
              <div
                key={`inspect-${reelIdx}-${currentCandidate.name}`}
                className={`elim-active-row ${isLocked ? 'is-passed' : 'is-rejected'}`}
              >
                <span className="elim-status-tag">
                  {isLocked ? (
                    <>
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      <span>통과</span>
                    </>
                  ) : (
                    <>
                      <X size={11} strokeWidth={3} aria-hidden="true" />
                      <span>기각</span>
                    </>
                  )}
                </span>

                <span className="elim-cand-name">{currentCandidate.name}</span>
                <span className="tabular elim-cand-reason">
                  {currentCandidate.strokes}획 · {currentCandidate.rejectReason}
                </span>

                {isLocked && (
                  <div className="lock-burst" aria-hidden="true">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span
                        key={i}
                        className="lock-burst-dot"
                        style={{ '--dot-angle': `${i * 45}deg` } as React.CSSProperties}
                      />
                    ))}
                  </div>
                )}
              </div>

              {recentRejected.length > 0 && (
                <div className="elim-tape" aria-hidden="true">
                  {recentRejected.map((item) => (
                    <span key={item.name} className="elim-tape-item">
                      <span className="elim-tape-name">{item.name}</span>
                      <span className="tabular elim-tape-diff">{item.rejectReason}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
