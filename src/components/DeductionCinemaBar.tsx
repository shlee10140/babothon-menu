import React, { useEffect, useMemo, useState } from 'react';
import { MenuItem, ProofResult } from '../types/menu';
import { analyzeSentence } from '../engine/hangulMath';
import { playReelTickSound } from '../engine/soundEngine';

interface DeductionCinemaBarProps {
  proof: ProofResult;
  phase: 1 | 2 | 3 | 4;
  runKey: number;
  menus: MenuItem[];
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

const REEL_DELAYS_MS = [0, 60, 125, 195, 275, 365, 470, 595, 740];

export const DeductionCinemaBar: React.FC<DeductionCinemaBarProps> = ({
  proof,
  phase,
  runKey,
  menus,
  soundOn,
  onSkip,
}) => {
  const formulaTokens = useMemo(
    () => tokenizeBridgeFormula(proof.bridgeExpression),
    [proof.bridgeExpression]
  );

  // Build 8 real decoy candidates + final winning menu at index 8 for Act 3 slot lock-on
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

  const [reelIdx, setReelIdx] = useState(0);

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

  const activeMenuCount = menus.filter((m) => m.enabled).length;
  const currentCandidate = reelItems[Math.min(reelIdx, reelItems.length - 1)];
  const isLocked = phase === 3 && currentCandidate?.isWinner;

  const actLabels = ['데이터 추출', '공식 연산', '메뉴 탐색'];

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

      {/* ACT 2 & 3: Live Kinetic Formula Assembly Ribbon */}
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
                style={{ animationDelay: `${idx * 130}ms` }}
              >
                {tok.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ACT 3: Live Candidate Pool Roulette & Lock-On */}
      {phase === 3 && currentCandidate && (
        <div className={`reel-card ${isLocked ? 'reel-card--locked' : ''}`}>
          <div className="reel-left">
            <span className="reel-badge">
              {isLocked ? '조건 일치' : `${activeMenuCount}개 후보 스캔`}
            </span>
            <span className="tabular reel-rule">
              {proof.menuAnalysis.totalStrokes}획 기준 매칭
            </span>
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
      )}
    </div>
  );
};
