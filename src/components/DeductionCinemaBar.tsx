import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { LiveWorldData, MenuItem, ProofResult } from '../types/menu';
import { analyzeSentence } from '../engine/hangulMath';
import { playReelTickSound, playVerifyTickSound } from '../engine/soundEngine';

interface DeductionCinemaBarProps {
  proof: ProofResult;
  phase: 1 | 2 | 3 | 4;
  runKey: number;
  menus: MenuItem[];
  liveData: LiveWorldData;
  soundOn: boolean;
  onSkip: () => void;
}

interface FormulaToken {
  text: string;
  kind: 'operand' | 'op' | 'result';
}

function tokenizeBridgeFormula(expr: string): FormulaToken[] {
  // Remove outer grouping parentheses while turning inner value parens like "음력(11일)" -> "음력 11일"
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

// 9 decelerating elimination steps over ~0.9s before the Act 4 reveal lands
const REEL_DELAYS_MS = [0, 65, 135, 215, 310, 420, 550, 705, 890];
const VERIFY_DELAYS_MS = [120, 400, 690];

function buildSurvivorCurve(total: number, steps: number): number[] {
  const safeTotal = Math.max(1, total);
  if (steps <= 1) return [1];
  const ratios = [1, 0.62, 0.36, 0.19, 0.095, 0.045, 0.018, 0.007, 0];
  const curve: number[] = [];
  for (let i = 0; i < steps; i++) {
    if (i === 0) {
      curve.push(safeTotal);
    } else if (i === steps - 1) {
      curve.push(1);
    } else {
      const ratio = ratios[Math.min(i, ratios.length - 2)];
      const prev = curve[i - 1];
      const raw = Math.max(2, Math.round(safeTotal * ratio));
      curve.push(Math.min(Math.max(1, prev - 1), raw));
    }
  }
  return curve;
}

export const DeductionCinemaBar: React.FC<DeductionCinemaBarProps> = ({
  proof,
  phase,
  runKey,
  menus,
  liveData,
  soundOn,
  onSkip,
}) => {
  const formulaTokens = useMemo(
    () => tokenizeBridgeFormula(proof.bridgeExpression),
    [proof.bridgeExpression]
  );

  const activeMenuCount = useMemo(() => menus.filter((m) => m.enabled).length, [menus]);

  // Build 8 real decoy candidates + final winning menu at the last step for Act 3 elimination lock-on
  const reelItems = useMemo(() => {
    const enabled = menus.filter((m) => m.enabled && m.name !== proof.menu.name);
    const seed = proof.sentence.utf16Sum + runKey * 37;
    const picked: { name: string; strokes: number; isWinner: boolean }[] = [];
    const used = new Set<string>();

    for (let i = 0; i < 8 && enabled.length > 0; i++) {
      const idx = (seed + i * 47) % enabled.length;
      const item = enabled[idx];
      if (!used.has(item.name)) {
        used.add(item.name);
        picked.push({
          name: item.name,
          strokes: analyzeSentence(item.name).totalStrokes,
          isWinner: false,
        });
      }
    }

    picked.push({
      name: proof.menu.name,
      strokes: proof.menuAnalysis.totalStrokes,
      isWinner: true,
    });
    return picked;
  }, [menus, proof.menu.name, proof.menuAnalysis.totalStrokes, proof.sentence.utf16Sum, runKey]);

  const survivorCurve = useMemo(
    () => buildSurvivorCurve(activeMenuCount, reelItems.length),
    [activeMenuCount, reelItems.length]
  );

  const [reelIdx, setReelIdx] = useState(0);
  const [verifiedStep, setVerifiedStep] = useState(0);

  // Act 2 staggered verification badges + tactile ticks
  useEffect(() => {
    if (phase < 2) {
      setVerifiedStep(0);
      return;
    }
    if (phase >= 3) {
      setVerifiedStep(3);
      return;
    }

    const timers = VERIFY_DELAYS_MS.map((delay, idx) =>
      window.setTimeout(() => {
        setVerifiedStep(idx + 1);
        playVerifyTickSound(idx, soundOn);
      }, delay)
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [phase, runKey, soundOn]);

  // Act 3 decelerating elimination reel
  useEffect(() => {
    if (phase !== 3) {
      setReelIdx(0);
      return;
    }

    const timers: number[] = [];
    const lastIdx = reelItems.length - 1;

    REEL_DELAYS_MS.slice(0, reelItems.length).forEach((delay, step) => {
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
  }, [phase, runKey, reelItems.length, soundOn]);

  if (phase === 4) return null;

  const currentCandidate = reelItems[Math.min(reelIdx, reelItems.length - 1)];
  const isLocked = phase === 3 && currentCandidate?.isWinner;
  const remainingCount = survivorCurve[Math.min(reelIdx, survivorCurve.length - 1)] ?? 1;
  const eliminatedTrail =
    phase === 3 && reelIdx > 0
      ? reelItems.slice(Math.max(0, reelIdx - 3), reelIdx).map((it) => it.name)
      : [];
  const barRatio = isLocked
    ? 1
    : Math.max(0.04, remainingCount / Math.max(1, activeMenuCount));

  const actLabels = ['정밀 채취', '교차 연산', '후보 소거'];
  const verifyLabels = [
    '입력 수치 추출',
    '실시간 변수 대입',
    `목표치 ${proof.menuAnalysis.totalStrokes}획 일치`,
  ];

  return (
    <div className="cinema-panel" aria-live="off">
      {/* Sleek 3-Act Hairline Progress Header + Instant Skip */}
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

        <button type="button" className="cinema-skip-btn" onClick={onSkip}>
          건너뛰기
        </button>
      </div>

      {/* ACT 1: High-Precision Real-Time Telemetry Extraction Card */}
      {phase === 1 && (
        <div className="telemetry-card" key={`tel-${runKey}`}>
          <div className="telemetry-head">
            <span className="telemetry-title">
              <span className="telemetry-live-dot" aria-hidden="true" />
              실시간 계측 데이터 동기화
            </span>
            <span className="tabular telemetry-precision">정밀도 99.9%</span>
          </div>
          <div className="telemetry-grid">
            <div className="telemetry-cell motion-pop-in" style={{ animationDelay: '40ms' }}>
              <span className="telemetry-k">문장 분해</span>
              <span className="tabular telemetry-v">
                {proof.sentence.charCount}자 · {proof.sentence.totalStrokes}획
              </span>
            </div>
            <div className="telemetry-cell motion-pop-in" style={{ animationDelay: '160ms' }}>
              <span className="telemetry-k">외부 변수</span>
              <span className="tabular telemetry-v">
                {liveData.weather.tempC.toFixed(1)}° · {liveData.fx.usdKrw.toLocaleString()}원
              </span>
            </div>
            <div className="telemetry-cell motion-pop-in" style={{ animationDelay: '280ms' }}>
              <span className="telemetry-k">후보 표본</span>
              <span className="tabular telemetry-v">{activeMenuCount}개 전수 로드</span>
            </div>
          </div>
        </div>
      )}

      {/* ACT 2 & 3: Live Kinetic Formula Assembly + Cross-Verification Checklist */}
      {phase >= 2 && (
        <div className="eq-ribbon" key={`eq-${runKey}`}>
          <div className="eq-ribbon-head">
            <span>실시간 공식 연산</span>
            <span className="tabular eq-target-hint">
              목표치 {proof.menuAnalysis.totalStrokes}획 도출
            </span>
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
          <div className="eq-checks">
            {verifyLabels.map((label, idx) => {
              const done = verifiedStep >= idx + 1;
              return (
                <span
                  key={label}
                  className={`eq-check-item ${done ? 'is-done' : ''}`}
                >
                  <Check size={11} strokeWidth={2.8} aria-hidden="true" />
                  <span>{label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ACT 3: Live Candidate Pool Elimination Engine (400 -> 1) */}
      {phase === 3 && currentCandidate && (
        <div className={`reel-card ${isLocked ? 'reel-card--locked' : ''}`}>
          <div className="reel-header-row">
            <div className="reel-left">
              <span className="reel-badge">
                {isLocked ? '유일 후보 확정' : '조건 미달 후보 소거 중'}
              </span>
              <span className="tabular reel-rule">
                {isLocked
                  ? `${activeMenuCount}개 중 ${activeMenuCount - 1}개 제외 · 최종 일치`
                  : `${proof.menuAnalysis.totalStrokes}획 기준 전수 대조`}
              </span>
            </div>

            <div className="elim-counter">
              <span className="tabular elim-count-num">{remainingCount}</span>
              <span className="elim-count-unit">/ {activeMenuCount}</span>
            </div>
          </div>

          <div className="elim-rail" aria-hidden="true">
            <div
              className={`elim-rail-fill ${isLocked ? 'is-locked' : ''}`}
              style={{ transform: `scaleX(${barRatio})` }}
            />
          </div>

          <div className="reel-bottom-row">
            <div className="reel-eliminated" aria-hidden="true">
              {eliminatedTrail.map((name) => (
                <span key={name} className="reel-elim-pill">
                  {name}
                </span>
              ))}
            </div>

            <div className="reel-slot-window">
              <div key={`${reelIdx}-${currentCandidate.name}`} className="reel-slot-item">
                <span className="reel-menu-name">{currentCandidate.name}</span>
                <span className="tabular reel-menu-strokes">
                  {currentCandidate.strokes}획
                </span>
              </div>
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
          </div>
        </div>
      )}
    </div>
  );
};
