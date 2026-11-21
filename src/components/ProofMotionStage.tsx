import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react';
import { ProofResult } from '../types/menu';
import { DUBEOLSIK_LAYOUT } from '../engine/hangulMath';

function buildMoonLitPath(cx: number, cy: number, r: number, phaseRatio: number): string {
  const rx = Math.max(0.5, Math.abs(Math.cos(phaseRatio * Math.PI * 2)) * r);
  const topY = cy - r;
  const botY = cy + r;
  const isWaxing = phaseRatio < 0.5;
  const outerSweep = isWaxing ? 1 : 0;
  const innerSweep =
    (isWaxing && phaseRatio < 0.25) || (!isWaxing && phaseRatio < 0.75) ? 0 : 1;
  return `M ${cx} ${topY} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${botY} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${topY} Z`;
}

function buildClockSectorPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
): string {
  const delta = Math.max(15, Math.min(359, endDeg - startDeg));
  const a1 = ((startDeg - 90) * Math.PI) / 180;
  const a2 = ((startDeg + delta - 90) * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

interface ProofMotionStageProps {
  proof: ProofResult;
  phase: 1 | 2 | 3 | 4;
  runKey: number;
  onSkip: () => void;
}

export const ProofMotionStage: React.FC<ProofMotionStageProps> = ({
  proof,
  phase,
  runKey,
  onSkip,
}) => {
  const { theory, sentence, menu, menuAnalysis } = proof;
  const isRevealed = phase === 4;

  // Smooth live count-up metrics during Act 1 & 2
  const [animatedStrokes, setAnimatedStrokes] = useState(sentence.totalStrokes);
  const [animatedTemp, setAnimatedTemp] = useState(proof.thermoMetrics?.excitationPct ?? 0);
  const [animatedWeatherTemp, setAnimatedWeatherTemp] = useState(proof.weatherMetrics?.tempC ?? 0);
  const [animatedMatchPct, setAnimatedMatchPct] = useState(proof.fingerprintMetrics?.matchPct ?? 0);
  const [animatedFx, setAnimatedFx] = useState(proof.fxMetrics?.usdKrw ?? 1395);
  const [animatedMoonPct, setAnimatedMoonPct] = useState(proof.moonMetrics?.illuminationPct ?? 0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const targetStrokes = sentence.totalStrokes;
    const targetTemp = proof.thermoMetrics?.excitationPct ?? 0;
    const targetWeather = proof.weatherMetrics?.tempC ?? 0;
    const targetMatch = proof.fingerprintMetrics?.matchPct ?? 0;
    const targetFx = proof.fxMetrics?.usdKrw ?? 1395;
    const targetMoon = proof.moonMetrics?.illuminationPct ?? 0;

    if (reduced) {
      setAnimatedStrokes(targetStrokes);
      setAnimatedTemp(targetTemp);
      setAnimatedWeatherTemp(targetWeather);
      setAnimatedMatchPct(targetMatch);
      setAnimatedFx(targetFx);
      setAnimatedMoonPct(targetMoon);
      return;
    }

    let rafId = 0;
    const start = performance.now();
    const duration = 960;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedStrokes(Math.round(targetStrokes * eased));
      setAnimatedTemp(Math.round(targetTemp * eased));
      setAnimatedWeatherTemp(Number((targetWeather * eased).toFixed(1)));
      setAnimatedMatchPct(Math.round(targetMatch * eased));
      setAnimatedFx(Math.round(targetFx * (0.93 + 0.07 * eased)));
      setAnimatedMoonPct(Math.round(targetMoon * eased));
      if (t < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    runKey,
    sentence.totalStrokes,
    proof.thermoMetrics?.excitationPct,
    proof.weatherMetrics?.tempC,
    proof.fingerprintMetrics?.matchPct,
    proof.fxMetrics?.usdKrw,
    proof.moonMetrics?.illuminationPct,
  ]);

  useEffect(() => {
    if (phase === 4) {
      setAnimatedStrokes(sentence.totalStrokes);
      setAnimatedTemp(proof.thermoMetrics?.excitationPct ?? 0);
      setAnimatedWeatherTemp(proof.weatherMetrics?.tempC ?? 0);
      setAnimatedMatchPct(proof.fingerprintMetrics?.matchPct ?? 0);
      setAnimatedFx(proof.fxMetrics?.usdKrw ?? 1395);
      setAnimatedMoonPct(proof.moonMetrics?.illuminationPct ?? 0);
    }
  }, [
    phase,
    sentence.totalStrokes,
    proof.thermoMetrics?.excitationPct,
    proof.weatherMetrics?.tempC,
    proof.fingerprintMetrics?.matchPct,
    proof.fxMetrics?.usdKrw,
    proof.moonMetrics?.illuminationPct,
  ]);

  const handleStageClick = () => {
    if (phase < 4) onSkip();
  };

  // 1. 초성 찾기 (Act 1 scan -> Act 2 bezier arcs to ? slots -> Act 4 menu reveal!)
  if (theory.id === 'conspiracy' && proof.conspiracyMatches) {
    const matches = proof.conspiracyMatches;
    const matchedOrigSet = new Set(matches.map((m) => m.sourceCharIdx));

    const totalLen = sentence.syllables.length;
    let displaySyls = sentence.syllables;
    if (totalLen > 11) {
      const keepIndices = new Set<number>(matchedOrigSet);
      for (let i = 0; i < totalLen && keepIndices.size < 11; i++) {
        keepIndices.add(i);
      }
      const sortedIndices = Array.from(keepIndices).sort((a, b) => a - b);
      displaySyls = sortedIndices.map((idx) => sentence.syllables[idx]);
    }

    const origToDisplaySlot = new Map<number, number>();
    displaySyls.forEach((s, slotIdx) => origToDisplaySlot.set(s.index, slotIdx));

    const svgW = 440;
    const svgH = 132;
    const topY = 28;
    const botY = 102;

    const getSourceX = (origIdx: number) => {
      const slot = origToDisplaySlot.get(origIdx) ?? 0;
      if (displaySyls.length <= 1) return svgW / 2;
      const margin = 26;
      return margin + (slot / (displaySyls.length - 1)) * (svgW - margin * 2);
    };

    const getTargetX = (mIdx: number) => {
      const count = menuAnalysis.syllables.length;
      if (count <= 1) return svgW / 2;
      const span = Math.min(230, count * 62);
      const start = svgW / 2 - span / 2;
      return start + (mIdx / (count - 1)) * span;
    };

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="문장 속 숨은 초성 추적 모션"
      >
        {phase <= 2 && <div className="scan-beam" aria-hidden="true" />}

        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
          {phase >= 2 &&
            matches.map((m, idx) => {
              const sx = getSourceX(m.sourceCharIdx);
              const tx = getTargetX(m.menuCharIdx);
              const midY = (topY + botY) / 2;
              return (
                <path
                  key={idx}
                  className="motion-draw-path"
                  style={{ animationDelay: `${idx * 110}ms` }}
                  pathLength={1}
                  d={`M ${sx} ${topY + 15} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${botY - 17}`}
                  fill="none"
                  stroke="#3182F6"
                  strokeWidth="2.2"
                />
              );
            })}

          {displaySyls.map((s, slotIdx) => {
            const x = getSourceX(s.index);
            const isHit = matchedOrigSet.has(s.index) && phase >= 2;
            return (
              <g
                key={s.index}
                transform={`translate(${x}, ${topY})`}
                className="motion-pop-svg"
                style={{ animationDelay: `${slotIdx * 35}ms` }}
              >
                <rect
                  x="-15"
                  y="-15"
                  width="30"
                  height="30"
                  rx="9"
                  fill={isHit ? '#3182F6' : '#FFFFFF'}
                  style={{ transition: 'fill 280ms ease' }}
                />
                <text
                  x="0"
                  y="4.5"
                  textAnchor="middle"
                  fill={isHit ? '#FFFFFF' : '#4E5968'}
                  fontSize="13"
                  fontWeight={isHit ? '700' : '600'}
                >
                  {s.char}
                </text>
              </g>
            );
          })}

          {menuAnalysis.syllables.map((ms, mIdx) => {
            const x = getTargetX(mIdx);
            return (
              <g key={mIdx} transform={`translate(${x}, ${botY})`}>
                <rect
                  x="-22"
                  y="-16"
                  width="44"
                  height="32"
                  rx="11"
                  fill={isRevealed ? '#191F28' : '#E5E8EB'}
                  style={{ transition: 'fill 260ms ease' }}
                />
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  fill={isRevealed ? '#FFFFFF' : '#8B95A1'}
                  fontSize="13.5"
                  fontWeight="700"
                >
                  {isRevealed ? ms.char : phase >= 2 ? ms.cho : '?'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // 2. 발음 지문 (No menu-name spoiler before Act 4!)
  if (theory.id === 'fingerprint' && proof.fingerprintMetrics) {
    const { matchedCount, totalCount, tokens } = proof.fingerprintMetrics;

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="문장과 메뉴 자모 지문 대조 모션"
      >
        {phase <= 2 && <div className="scan-beam" aria-hidden="true" />}
        <div className="fp-wrap">
          <div className="fp-head">
            <span className="fp-label">자음·모음 지문 대조</span>
            <span className="tabular fp-pct">
              {phase >= 2 ? `${animatedMatchPct}% 일치` : '스캔 중'}
            </span>
          </div>

          <div className="fp-chips">
            {tokens.map((tok, idx) => {
              const lit = tok.matched && phase >= 2;
              return (
                <span
                  key={`${idx}-${tok.jamo}`}
                  className={`fp-chip motion-pop-in ${lit ? 'fp-chip--hit' : ''}`}
                  style={{ animationDelay: `${idx * 55}ms` }}
                >
                  {tok.jamo}
                </span>
              );
            })}
          </div>

          <div className={`fp-foot motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
            <span>
              {isRevealed ? `‘${menu.name}’ 구성 자모 ${totalCount}개 중` : `음소 ${totalCount}개 대조 결과`}
            </span>
            <strong className="tabular" style={{ color: 'var(--accent)' }}>
              {matchedCount}개 그대로 일치
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // 3. 시계 각도 (Glowing blue swept sector arc + smooth hand rotation!)
  if (theory.id === 'clock' && proof.clockMetrics) {
    const { startHour12, turnSteps, endHour12, startDeg, endDeg } = proof.clockMetrics;
    const activeDeg = phase >= 2 ? endDeg : startDeg;
    const endAngleRad = ((endHour12 % 12) * 30 - 90) * (Math.PI / 180);
    const dotX = 60 + Math.cos(endAngleRad) * 44;
    const dotY = 60 + Math.sin(endAngleRad) * 44;
    const sectorPath = buildClockSectorPath(60, 60, 44, startDeg, endDeg);

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="현재 시각에서 글자 수만큼 시계 바늘 회전 모션"
      >
        <div className="clock-layout">
          <svg
            viewBox="0 0 120 120"
            className="clock-svg"
            role="img"
            aria-label={`${startHour12}시에서 ${endHour12}시로 회전하는 시계`}
          >
            <circle cx="60" cy="60" r="54" fill="#FFFFFF" stroke="#E5E8EB" strokeWidth="1.5" />

            {/* Swept angle luminous blue sector */}
            {phase >= 2 && (
              <path
                d={sectorPath}
                fill="rgba(49, 130, 246, 0.11)"
                className="motion-pop-svg"
              />
            )}

            {Array.from({ length: 12 }).map((_, i) => {
              const rad = (i * 30 - 90) * (Math.PI / 180);
              const isMajor = i % 3 === 0;
              const r1 = isMajor ? 43 : 46;
              const r2 = 49.5;
              return (
                <line
                  key={i}
                  x1={60 + Math.cos(rad) * r1}
                  y1={60 + Math.sin(rad) * r1}
                  x2={60 + Math.cos(rad) * r2}
                  y2={60 + Math.sin(rad) * r2}
                  stroke={isMajor ? '#8B95A1' : '#D1D6DB'}
                  strokeWidth={isMajor ? 2 : 1.4}
                  strokeLinecap="round"
                />
              );
            })}

            <g transform={`rotate(${startDeg} 60 60)`}>
              <line
                x1="60"
                y1="60"
                x2="60"
                y2="29"
                stroke="#D1D6DB"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>

            {phase >= 2 && (
              <g transform={`translate(${dotX}, ${dotY})`} className="motion-pop-svg">
                <circle r="7.5" fill="rgba(49, 130, 246, 0.22)" className="pulse-ring" />
                <circle r="4" fill="#3182F6" />
              </g>
            )}

            <g
              className="clock-hand-group"
              style={{ transform: `rotate(${activeDeg}deg)` }}
            >
              <line
                x1="60"
                y1="66"
                x2="60"
                y2="24"
                stroke="#3182F6"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </g>
            <circle cx="60" cy="60" r="4.2" fill="#191F28" />
          </svg>

          <div className="clock-readout">
            <div className="clock-meta-row">
              <span>시작 시각</span>
              <strong className="tabular">{startHour12}시</strong>
            </div>
            <div className="clock-meta-row">
              <span>글자 회전</span>
              <strong className="tabular">+{turnSteps}칸 ({turnSteps * 30}°)</strong>
            </div>
            <div className={`clock-meta-row clock-meta-row--accent motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
              <span>멈춘 눈금</span>
              <strong className="tabular">{endHour12}시 방향</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. 실시간 날씨 (Live ticking temperature + animated humidity bar!)
  if (theory.id === 'weather' && proof.weatherMetrics) {
    const { tempC, humidity, windKmh, skyLabel, icon, moodLabel } = proof.weatherMetrics;
    const IconComp =
      icon === 'sun'
        ? Sun
        : icon === 'cloud'
        ? Cloud
        : icon === 'rain'
        ? CloudRain
        : icon === 'snow'
        ? Snowflake
        : CloudSun;

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="실시간 바깥 날씨 측정 모션"
      >
        {phase === 1 && <div className="scan-beam" aria-hidden="true" />}
        <div className="weather-layout">
          <div className="weather-hero motion-pop-in">
            <div className="weather-icon-badge" aria-hidden="true">
              <IconComp size={26} strokeWidth={2} />
            </div>
            <div className="weather-temp-col">
              <span className="tabular weather-temp-val">
                {phase >= 2 ? tempC : animatedWeatherTemp}°
              </span>
              <span className="weather-sky">{skyLabel}</span>
            </div>
          </div>

          <div className="weather-metrics">
            <div className="clock-meta-row">
              <span>습도</span>
              <strong className="tabular">{humidity}%</strong>
            </div>
            <div className="weather-hum-rail">
              <div
                className={`weather-hum-fill ${phase >= 2 ? 'is-filled' : ''}`}
                style={{ width: `${Math.max(10, humidity)}%` }}
              />
            </div>
            <div className="clock-meta-row">
              <span>풍속</span>
              <strong className="tabular">{windKmh} km/h</strong>
            </div>
            <div className={`clock-meta-row clock-meta-row--accent motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
              <span>날씨 맞춤</span>
              <strong>{moodLabel}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. 실시간 환율 (Toss Securities sparkline drawing + live ticking rate)
  if (theory.id === 'fx' && proof.fxMetrics) {
    const { usdKrw, digits, digitSum: fxSum, points } = proof.fxMetrics;
    const svgW = 400;
    const svgH = 74;
    const coords = points.map((v, i) => ({
      x: 8 + (i / Math.max(1, points.length - 1)) * (svgW - 22),
      y: svgH - 12 - v * (svgH - 22),
    }));
    const lineD = coords
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');
    const areaD = `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${svgH} L ${coords[0].x.toFixed(1)} ${svgH} Z`;
    const lastPt = coords[coords.length - 1];

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="실시간 원 달러 환율 흐름 모션"
      >
        <div className="fx-wrap">
          <div className="fx-head">
            <span className="fx-pair">USD / KRW 실시간 환율</span>
            <span className="tabular fx-rate">
              {(phase >= 2 ? usdKrw : animatedFx).toLocaleString()}원
            </span>
          </div>

          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
            <defs>
              <linearGradient id={`fxGrad-${runKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3182F6" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#3182F6" stopOpacity="0" />
              </linearGradient>
            </defs>
            {phase >= 2 && (
              <path
                d={areaD}
                fill={`url(#fxGrad-${runKey})`}
                className="motion-pop-svg"
              />
            )}
            <path
              d={lineD}
              fill="none"
              stroke="#3182F6"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="motion-draw-path-slow"
            />
            {phase >= 2 && lastPt && (
              <g transform={`translate(${lastPt.x}, ${lastPt.y})`} className="motion-pop-svg">
                <circle r="9" fill="rgba(49, 130, 246, 0.22)" className="pulse-ring" />
                <circle r="4" fill="#3182F6" />
              </g>
            )}
          </svg>

          <div className={`fx-foot motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
            <span>자릿수 분해</span>
            <strong className="tabular" style={{ color: 'var(--ink-primary)' }}>
              {digits.join(' + ')} = <span style={{ color: 'var(--accent)' }}>{fxSum}</span>
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // 6. 오늘 달 위상 (Midnight stars + expanding glow halo + accurate lunar terminator)
  if (theory.id === 'moon' && proof.moonMetrics) {
    const { illuminationPct, lunarDay, phaseRatio, phaseName } = proof.moonMetrics;
    const isFull = illuminationPct >= 97;
    const isNew = illuminationPct <= 3;

    return (
      <div
        key={runKey}
        className={`visual-stage visual-stage--night ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="오늘 밤하늘 달 위상 모션"
      >
        <div className="moon-layout">
          <svg
            viewBox="0 0 96 96"
            className="moon-svg"
            role="img"
            aria-label={`밝기 ${illuminationPct}% ${phaseName}`}
          >
            {/* Subtle background starlight */}
            <circle cx="11" cy="18" r="1.2" fill="rgba(255,255,255,0.45)" />
            <circle cx="84" cy="22" r="1.5" fill="rgba(147,197,253,0.6)" />
            <circle cx="16" cy="80" r="1" fill="rgba(255,255,255,0.35)" />
            <circle cx="86" cy="76" r="1.2" fill="rgba(255,255,255,0.4)" />

            <circle
              cx="48"
              cy="48"
              r="41"
              fill="rgba(96, 165, 250, 0.12)"
              className={phase >= 2 ? 'pulse-ring' : ''}
            />
            <circle cx="48" cy="48" r="34" fill="#232D3F" />
            {phase >= 2 && isFull && (
              <circle cx="48" cy="48" r="34" fill="#F8FAFC" className="motion-pop-svg" />
            )}
            {phase >= 2 && !isFull && !isNew && (
              <path
                d={buildMoonLitPath(48, 48, 34, phaseRatio)}
                fill="#F8FAFC"
                className="motion-pop-svg"
              />
            )}
            <circle cx="48" cy="48" r="34" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          </svg>

          <div className="moon-readout">
            <div className="moon-meta-row">
              <span>오늘의 달</span>
              <strong>{phaseName}</strong>
            </div>
            <div className="moon-meta-row">
              <span>음력 주기</span>
              <strong className="tabular">{lunarDay}일차</strong>
            </div>
            <div className={`moon-meta-row moon-meta-row--accent motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
              <span>달 밝기</span>
              <strong className="tabular">{phase >= 2 ? illuminationPct : animatedMoonPct}%</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 7. 획수 계산 (No menu spoiler before Act 4!)
  if (theory.id === 'numerology') {
    const shown = sentence.syllables.slice(0, 9);
    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="글자 획수 집계 모션"
      >
        <div className="num-flow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
              문장 획수 집계
            </span>
            <span
              className="tabular"
              style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--ink-primary)' }}
            >
              총 {animatedStrokes}획
            </span>
          </div>

          <div className="num-tokens">
            {shown.map((s, idx) => (
              <span
                key={s.index}
                className="num-token motion-pop-in"
                style={{ animationDelay: `${idx * 45}ms` }}
              >
                <span>{s.char}</span>
                <span className="num-token-sub">{s.totalStrokes}</span>
              </span>
            ))}
            {sentence.syllables.length > 9 && (
              <span className="tabular" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                +{sentence.syllables.length - 9}글자
              </span>
            )}
          </div>

          <div
            className={`motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.4rem',
              paddingTop: '0.6rem',
              borderTop: '1px solid var(--line)',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
              {isRevealed ? '계산 결과 일치' : '목표 획수 산출'}
            </span>
            <div className="num-tokens">
              {isRevealed ? (
                menuAnalysis.syllables.map((ms) => (
                  <span key={ms.index} className="num-token num-token--accent">
                    <span>{ms.char}</span>
                    <span className="num-token-sub">{ms.totalStrokes}</span>
                  </span>
                ))
              ) : (
                <span className="num-token num-token--accent">
                  <span>?</span>
                </span>
              )}
              <span
                className="tabular"
                style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--accent)', paddingLeft: 4 }}
              >
                = {menuAnalysis.totalStrokes}획
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 8. 키보드 동선 (Menu keys & target centroid lock in on Act 4!)
  if (theory.id === 'keyboard') {
    const svgW = 440;
    const svgH = 136;
    const keyW = 35;
    const keyH = 33;
    const gap = 5.5;
    const offsetX = 20;
    const offsetY = 12;

    const toSvgCoord = (xMm: number, yMm: number) => {
      const col = xMm / 19.05;
      const row = yMm / 19.05;
      return {
        x: offsetX + col * (keyW + gap) + keyW / 2,
        y: offsetY + row * (keyH + gap) + keyH / 2,
      };
    };

    const pressedSet = new Set(sentence.keystrokes.map((k) => k.jamo));
    const menuKeySet = new Set(menuAnalysis.keystrokes.map((k) => k.jamo));
    const polyPoints = sentence.keystrokes
      .slice(0, 28)
      .map((k) => {
        const pt = toSvgCoord(k.xMm, k.yMm);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');

    const sentCenter = toSvgCoord(sentence.centroidMm.x, sentence.centroidMm.y);
    const menuCenter = toSvgCoord(menuAnalysis.centroidMm.x, menuAnalysis.centroidMm.y);

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="키보드 손가락 이동 궤적 모션"
      >
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
          {DUBEOLSIK_LAYOUT.map((k) => {
            const x = offsetX + k.col * (keyW + gap);
            const y = offsetY + k.row * (keyH + gap);
            const isMenuKey = menuKeySet.has(k.jamo) && isRevealed;
            const isPressed = pressedSet.has(k.jamo);
            return (
              <g key={k.jamo} transform={`translate(${x}, ${y})`}>
                <rect
                  width={keyW}
                  height={keyH}
                  rx="8"
                  fill={isMenuKey ? '#3182F6' : isPressed ? '#DCE1E7' : '#FFFFFF'}
                  style={{ transition: 'fill 300ms ease' }}
                />
                <text
                  x={keyW / 2}
                  y={keyH / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={isMenuKey || isPressed ? '700' : '500'}
                  fill={isMenuKey ? '#FFFFFF' : '#191F28'}
                >
                  {k.jamo}
                </text>
              </g>
            );
          })}

          {polyPoints && (
            <polyline
              className="motion-draw-path-slow"
              pathLength={1}
              points={polyPoints}
              fill="none"
              stroke="rgba(49, 130, 246, 0.6)"
              strokeWidth="2.1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {isRevealed && (
            <line
              x1={sentCenter.x}
              y1={sentCenter.y}
              x2={menuCenter.x}
              y2={menuCenter.y}
              stroke="#191F28"
              strokeWidth="1.6"
              strokeDasharray="3 2.5"
              className="motion-pop-svg"
            />
          )}

          {phase >= 2 && (
            <g transform={`translate(${sentCenter.x}, ${sentCenter.y})`} className="motion-pop-svg">
              <circle r="12" fill="rgba(49, 130, 246, 0.22)" className="pulse-ring" />
              <circle r="7" fill="rgba(49, 130, 246, 0.24)" stroke="#3182F6" strokeWidth="2" />
              <circle r="3" fill="#3182F6" />
            </g>
          )}

          {isRevealed && (
            <g transform={`translate(${menuCenter.x}, ${menuCenter.y})`} className="motion-pop-svg">
              <circle r="5.5" fill="#FFFFFF" stroke="#191F28" strokeWidth="2.2" />
            </g>
          )}
        </svg>
      </div>
    );
  }

  // 9. 글자 별자리 (Constellation name reveals ONLY on Act 4!)
  if (theory.id === 'constellation' && proof.constellation) {
    const { stars, constellationName } = proof.constellation;
    const svgW = 440;
    const svgH = 148;
    const pts = stars.map((st) => ({
      ...st,
      sx: (st.x / 100) * svgW,
      sy: (st.y / 100) * svgH,
    }));
    const poly = pts.map((p) => `${p.sx},${p.sy}`).join(' ');

    return (
      <div
        key={runKey}
        className={`visual-stage visual-stage--night ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="글자 별자리 좌표 모션"
      >
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
          <line x1="24" y1="124" x2="416" y2="124" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="24" y1="22" x2="24" y2="124" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

          {phase >= 2 && poly && (
            <polyline
              className="motion-draw-path-slow"
              pathLength={1}
              points={poly}
              fill="none"
              stroke="#60A5FA"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {pts.map((p, idx) => (
            <g
              key={idx}
              transform={`translate(${p.sx}, ${p.sy})`}
              className="motion-pop-svg"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <circle r="8" fill="rgba(96, 165, 250, 0.24)" />
              <circle r="3.2" fill="#FFFFFF" />
              <text
                x="0"
                y="-11"
                textAnchor="middle"
                fill="rgba(255,255,255,0.9)"
                fontSize="11"
                fontWeight="600"
              >
                {p.char}
              </text>
            </g>
          ))}

          {phase >= 2 && (
            <g transform={`translate(${svgW - 18}, 24)`} className="motion-pop-svg">
              <text
                x="0"
                y="0"
                textAnchor="end"
                fill="#93C5FD"
                fontSize="12"
                fontWeight="700"
              >
                {isRevealed ? `★ ${constellationName}` : '★ 별자리 판독 중'}
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // 10. 받침 리듬파 (Menu pattern reveals ONLY on Act 4!)
  if (theory.id === 'morse' && proof.morse) {
    const { beats, bpm, menuPatternText } = proof.morse;
    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="받침 리듬 파형 모션"
      >
        <div className="morse-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
            <span>음절 리듬 파형</span>
            <span className="tabular" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {bpm} BPM · {isRevealed ? '리듬 일치' : '파형 분석 중'}
            </span>
          </div>

          <div className="morse-bars">
            {beats.map((b, idx) => (
              <div key={idx} className="morse-col">
                <div className="morse-bar-track">
                  <div
                    className={`morse-bar ${b.isLong ? 'morse-bar--long' : ''}`}
                    style={{
                      height: `${Math.round(b.amplitude * 100)}%`,
                      animationDelay: `${idx * 65}ms`,
                    }}
                  />
                </div>
                <span className="morse-char">{b.char}</span>
                <span className="morse-sym">{b.isLong ? '—' : '·'}</span>
              </div>
            ))}
          </div>

          <div className={`morse-compare motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}>
            <span>메뉴 리듬</span>
            <strong style={{ color: 'var(--accent)' }}>
              {isRevealed ? menuPatternText : '닮은 박자 매칭 중…'}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // 11. 원소 조합 (Final menu card stays '?' until Act 4!)
  if (theory.id === 'periodic' && proof.periodicTerms) {
    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="주기율표 원소 조합 모션"
      >
        <div className="chem-flow">
          {proof.periodicTerms.map((term, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <span style={{ fontWeight: 700, color: 'var(--ink-muted)' }}>+</span>
              )}
              <div
                className="chem-card motion-pop-in"
                style={{ animationDelay: `${idx * 95}ms` }}
              >
                <span className="chem-z">{term.atomicNumber}</span>
                <span className="chem-sym">{term.symbol}</span>
                <span className="chem-word">{term.sourceChunk}</span>
              </div>
            </React.Fragment>
          ))}

          {phase >= 2 && (
            <span style={{ fontWeight: 700, color: 'var(--accent)', padding: '0 2px' }}>→</span>
          )}

          <div
            className={`chem-card ${isRevealed ? 'chem-card--result motion-pop-in' : ''}`}
            style={{ opacity: phase >= 2 ? 1 : 0.35 }}
          >
            <span className="chem-z">{phase >= 2 ? `${menuAnalysis.totalStrokes}획` : '···'}</span>
            <span className="chem-sym">{isRevealed ? menu.name : '?'}</span>
            <span className="chem-word">{isRevealed ? '완성' : '합성 중'}</span>
          </div>
        </div>
      </div>
    );
  }

  // 12. 유니코드
  if (theory.id === 'unicode' && proof.unicodeFactors) {
    const shown = sentence.syllables.slice(0, 6);
    const { sumHex, digitSum: codeDigitSum, modulus } = proof.unicodeFactors;

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="유니코드 분해 모션"
      >
        <div className="num-tokens">
          {shown.map((s, idx) => (
            <span
              key={s.index}
              className="num-token motion-pop-in"
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <span>{s.char}</span>
              <span className="num-token-sub">{phase >= 2 ? s.hex : 'U+····'}</span>
            </span>
          ))}
        </div>
        <div
          className={`tabular motion-reveal-block ${phase >= 2 ? 'is-visible' : ''}`}
          style={{
            fontSize: '0.8rem',
            color: 'var(--ink-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.4rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--line)',
          }}
        >
          <span>
            합계 {sumHex} · 자릿수 합 {codeDigitSum}
          </span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
            {phase >= 2 ? `고유수 ${modulus}` : '계산 중'}
          </span>
        </div>
      </div>
    );
  }

  // 13. 말투 온도
  if (theory.id === 'thermodynamics' && proof.thermoMetrics) {
    const { yangPct, yinPct } = proof.thermoMetrics;
    const neutralPct = Math.max(0, 100 - yangPct - yinPct);

    return (
      <div
        key={runKey}
        className={`visual-stage ${phase < 4 ? 'visual-stage--cinema' : ''}`}
        data-phase={phase}
        onClick={handleStageClick}
        aria-label="말투 온도 측정 모션"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--ink-secondary)',
          }}
        >
          <span>밝은 모음 {yangPct}% · 어두운 모음 {yinPct}%</span>
          <span className="tabular" style={{ color: 'var(--accent)', fontWeight: 800 }}>
            {animatedTemp}°
          </span>
        </div>
        <div className="thermo-rail">
          <div className={`thermo-track ${phase >= 2 ? 'is-revealed' : ''}`}>
            <div style={{ width: `${Math.max(8, yangPct)}%`, background: '#3182F6' }} />
            <div style={{ width: `${neutralPct}%`, background: '#DFE3E8' }} />
            <div style={{ width: `${Math.max(8, yinPct)}%`, background: '#191F28' }} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
