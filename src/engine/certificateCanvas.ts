import { ProofResult } from '../types/menu';
import { DUBEOLSIK_LAYOUT } from './hangulMath';
import { josa } from './proofEngine';

const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawVisualStage(
  ctx: CanvasRenderingContext2D,
  proof: ProofResult,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const { theory, sentence, menu, menuAnalysis } = proof;
  const isNight = theory.id === 'constellation' || theory.id === 'moon';

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fillStyle = isNight ? '#141923' : '#F2F4F6';
  ctx.fill();
  ctx.clip();

  // 1. 초성 찾기
  if (theory.id === 'conspiracy' && proof.conspiracyMatches) {
    const matches = proof.conspiracyMatches;
    const matchedSet = new Set(matches.map((m) => m.sourceCharIdx));
    let displaySyls = sentence.syllables;
    if (displaySyls.length > 10) {
      const keep = new Set<number>(matchedSet);
      for (let i = 0; i < displaySyls.length && keep.size < 10; i++) keep.add(i);
      displaySyls = Array.from(keep)
        .sort((a, b) => a - b)
        .map((idx) => sentence.syllables[idx]);
    }
    const slotMap = new Map<number, number>();
    displaySyls.forEach((s, i) => slotMap.set(s.index, i));

    const topY = y + 36;
    const botY = y + h - 34;
    const getSrcX = (origIdx: number) => {
      const slot = slotMap.get(origIdx) ?? 0;
      if (displaySyls.length <= 1) return x + w / 2;
      const m = 28;
      return x + m + (slot / (displaySyls.length - 1)) * (w - m * 2);
    };
    const getDstX = (mIdx: number) => {
      const cnt = menuAnalysis.syllables.length;
      if (cnt <= 1) return x + w / 2;
      const span = Math.min(256, cnt * 54);
      return x + w / 2 - span / 2 + (mIdx / (cnt - 1)) * span;
    };

    // Curved bezier lines
    ctx.strokeStyle = '#3182F6';
    ctx.lineWidth = 1.8;
    matches.forEach((m) => {
      const sx = getSrcX(m.sourceCharIdx);
      const tx = getDstX(m.menuCharIdx);
      const midY = (topY + botY) / 2;
      ctx.beginPath();
      ctx.moveTo(sx, topY + 13);
      ctx.bezierCurveTo(sx, midY, tx, midY, tx, botY - 14);
      ctx.stroke();
    });

    // Top row syllables
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    displaySyls.forEach((s) => {
      const cx = getSrcX(s.index);
      const isHit = matchedSet.has(s.index);
      fillRoundRect(ctx, cx - 13, topY - 13, 26, 26, 8, isHit ? '#3182F6' : '#FFFFFF');
      ctx.fillStyle = isHit ? '#FFFFFF' : '#4E5968';
      ctx.font = `${isHit ? 700 : 600} 11.5px ${FONT}`;
      ctx.fillText(s.char, cx, topY + 0.5);
    });

    // Bottom row menu tiles
    menuAnalysis.syllables.forEach((ms, i) => {
      const cx = getDstX(i);
      fillRoundRect(ctx, cx - 19, botY - 14, 38, 28, 9, '#191F28');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText(ms.char, cx, botY + 0.5);
    });

    ctx.restore();
    return;
  }

  // 2. 발음 지문
  if (theory.id === 'fingerprint' && proof.fingerprintMetrics) {
    const { matchPct, matchedCount, totalCount, tokens } = proof.fingerprintMetrics;
    const padX = x + 16;
    ctx.textBaseline = 'alphabetic';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('자음·모음 지문 대조', padX, y + 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(`${matchPct}% 일치`, x + w - 16, y + 26);

    // Chips row (wrap gracefully up to 2 rows)
    const chipSize = 27;
    const chipGap = 5.5;
    let cx = padX;
    let cy = y + 40;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    tokens.slice(0, 18).forEach((tok) => {
      if (cx + chipSize > x + w - 16) {
        cx = padX;
        cy += chipSize + 5;
      }
      if (cy + chipSize <= y + h - 30) {
        fillRoundRect(ctx, cx, cy, chipSize, chipSize, 8, tok.matched ? '#3182F6' : '#FFFFFF');
        ctx.fillStyle = tok.matched ? '#FFFFFF' : '#8B95A1';
        ctx.font = `700 12px ${FONT}`;
        ctx.fillText(tok.jamo, cx + chipSize / 2, cy + chipSize / 2 + 0.5);
      }
      cx += chipSize + chipGap;
    });

    // Divider & footer
    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + h - 28);
    ctx.lineTo(x + w - 16, y + h - 28);
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(`‘${menu.name}’ 구성 자모 ${totalCount}개 중`, padX, y + h - 11);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`${matchedCount}개 그대로 일치`, x + w - 16, y + h - 11);

    ctx.restore();
    return;
  }

  // 3. 시계 각도
  if (theory.id === 'clock' && proof.clockMetrics) {
    const { startHour12, turnSteps, endHour12, startDeg, endDeg } = proof.clockMetrics;
    const cx = x + 76;
    const cy = y + h / 2;
    const r = 46;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const rad = (i * 30 - 90) * (Math.PI / 180);
      const isMajor = i % 3 === 0;
      const r1 = isMajor ? r - 9 : r - 6.5;
      const r2 = r - 3.5;
      ctx.strokeStyle = isMajor ? '#8B95A1' : '#D1D6DB';
      ctx.lineWidth = isMajor ? 1.8 : 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
      ctx.lineTo(cx + Math.cos(rad) * r2, cy + Math.sin(rad) * r2);
      ctx.stroke();
    }

    // Start hand (faint)
    const startRad = (startDeg - 90) * (Math.PI / 180);
    ctx.strokeStyle = '#D1D6DB';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(startRad) * 26, cy + Math.sin(startRad) * 26);
    ctx.stroke();

    // End target dot
    const endRad = ((endDeg % 360) - 90) * (Math.PI / 180);
    const dx = cx + Math.cos(endRad) * (r - 8.5);
    const dy = cy + Math.sin(endRad) * (r - 8.5);
    ctx.fillStyle = 'rgba(49, 130, 246, 0.22)';
    ctx.beginPath();
    ctx.arc(dx, dy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3182F6';
    ctx.beginPath();
    ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Primary blue hand
    ctx.strokeStyle = '#3182F6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(endRad) * 5, cy - Math.sin(endRad) * 5);
    ctx.lineTo(cx + Math.cos(endRad) * 30, cy + Math.sin(endRad) * 30);
    ctx.stroke();

    ctx.fillStyle = '#191F28';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Right readout rows
    const rx = x + 146;
    const rightEnd = x + w - 22;
    const rows: [string, string, boolean][] = [
      ['시작 시각', `${startHour12}시`, false],
      ['글자 회전', `+${turnSteps}칸 (${turnSteps * 30}°)`, false],
      ['멈춘 눈금', `${endHour12}시 방향`, true],
    ];
    ctx.textBaseline = 'alphabetic';
    rows.forEach(([label, val, accent], idx) => {
      const ry = y + 42 + idx * 30 + (accent ? 6 : 0);
      if (accent) {
        ctx.strokeStyle = '#E5E8EB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 17);
        ctx.lineTo(rightEnd, ry - 17);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4E5968';
      ctx.font = `500 11.5px ${FONT}`;
      ctx.fillText(label, rx, ry);

      ctx.textAlign = 'right';
      ctx.fillStyle = accent ? '#3182F6' : '#191F28';
      ctx.font = `${accent ? 800 : 700} 12px ${FONT}`;
      ctx.fillText(val, rightEnd, ry);
    });

    ctx.restore();
    return;
  }

  // 4. 실시간 날씨
  if (theory.id === 'weather' && proof.weatherMetrics) {
    const { tempC, humidity, windKmh, skyLabel, icon, moodLabel } = proof.weatherMetrics;
    const badgeX = x + 20;
    const badgeY = y + h / 2 - 24;
    fillRoundRect(ctx, badgeX, badgeY, 48, 48, 15, '#FFFFFF');

    // Crisp minimal vector icon inside badge
    const icx = badgeX + 24;
    const icy = badgeY + 24;
    ctx.strokeStyle = '#3182F6';
    ctx.fillStyle = '#3182F6';
    ctx.lineWidth = 2;
    if (icon === 'sun') {
      ctx.beginPath();
      ctx.arc(icx, icy, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (icon === 'rain' || icon === 'snow') {
      ctx.beginPath();
      ctx.arc(icx - 4, icy - 3, 7, Math.PI, Math.PI * 2);
      ctx.arc(icx + 5, icy - 2, 6, Math.PI * 1.1, Math.PI * 0.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(icx - 5, icy + 8);
      ctx.lineTo(icx - 7, icy + 13);
      ctx.moveTo(icx + 2, icy + 8);
      ctx.lineTo(icx, icy + 13);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(icx - 5, icy - 4, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      fillRoundRect(ctx, icx - 10, icy - 1, 22, 11, 5.5, '#3182F6');
    }

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#191F28';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(`${tempC}°`, badgeX + 60, y + h / 2 + 2);
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(skyLabel, badgeX + 60, y + h / 2 + 19);

    const rx = x + 186;
    const rightEnd = x + w - 20;
    const rows: [string, string, boolean][] = [
      ['습도', `${humidity}%`, false],
      ['풍속', `${windKmh} km/h`, false],
      ['날씨 맞춤', moodLabel, true],
    ];
    rows.forEach(([label, val, accent], idx) => {
      const ry = y + 40 + idx * 30 + (accent ? 6 : 0);
      if (accent) {
        ctx.strokeStyle = '#E5E8EB';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 17);
        ctx.lineTo(rightEnd, ry - 17);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#4E5968';
      ctx.font = `500 11px ${FONT}`;
      ctx.fillText(label, rx, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = accent ? '#3182F6' : '#191F28';
      ctx.font = `${accent ? 800 : 700} 11.5px ${FONT}`;
      ctx.fillText(val, rightEnd, ry);
    });

    ctx.restore();
    return;
  }

  // 5. 실시간 환율
  if (theory.id === 'fx' && proof.fxMetrics) {
    const { usdKrw, digits, digitSum: fxSum, points } = proof.fxMetrics;
    const padX = x + 16;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText('USD / KRW 실시간 환율', padX, y + 25);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `800 16px ${FONT}`;
    ctx.fillText(`${usdKrw.toLocaleString()}원`, x + w - 16, y + 27);

    const chartLeft = padX;
    const chartRight = x + w - 20;
    const chartTop = y + 40;
    const chartBottom = y + h - 38;
    const pts = points.map((v, i) => ({
      px: chartLeft + (i / Math.max(1, points.length - 1)) * (chartRight - chartLeft),
      py: chartBottom - v * (chartBottom - chartTop),
    }));

    const grad = ctx.createLinearGradient(0, chartTop, 0, chartBottom + 6);
    grad.addColorStop(0, 'rgba(49, 130, 246, 0.2)');
    grad.addColorStop(1, 'rgba(49, 130, 246, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.px, pt.py) : ctx.lineTo(pt.px, pt.py)));
    ctx.lineTo(pts[pts.length - 1].px, chartBottom + 4);
    ctx.lineTo(pts[0].px, chartBottom + 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#3182F6';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.px, pt.py) : ctx.lineTo(pt.px, pt.py)));
    ctx.stroke();

    const lastPt = pts[pts.length - 1];
    ctx.fillStyle = '#3182F6';
    ctx.beginPath();
    ctx.arc(lastPt.px, lastPt.py, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + h - 28);
    ctx.lineTo(x + w - 16, y + h - 28);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 10.5px ${FONT}`;
    ctx.fillText('자릿수 분해', padX, y + h - 11);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`${digits.join(' + ')} = ${fxSum}`, x + w - 16, y + h - 11);

    ctx.restore();
    return;
  }

  // 6. 오늘 달 위상 (밤하늘 다크 카드)
  if (theory.id === 'moon' && proof.moonMetrics) {
    const { illuminationPct, lunarDay, phaseRatio, phaseName } = proof.moonMetrics;
    const cx = x + 78;
    const cy = y + h / 2;
    const r = 34;

    ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#232D3F';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    if (illuminationPct >= 97) {
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (illuminationPct > 3) {
      const rx = Math.max(0.5, Math.abs(Math.cos(phaseRatio * Math.PI * 2)) * r);
      const isWaxing = phaseRatio < 0.5;
      const outerSweep = isWaxing ? 1 : 0;
      const innerSweep =
        (isWaxing && phaseRatio < 0.25) || (!isWaxing && phaseRatio < 0.75) ? 0 : 1;
      const p2d = new Path2D(
        `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`
      );
      ctx.fillStyle = '#F8FAFC';
      ctx.fill(p2d);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const rx = x + 146;
    const rightEnd = x + w - 22;
    const rows: [string, string, boolean][] = [
      ['오늘의 달', phaseName, false],
      ['음력 주기', `${lunarDay}일차`, false],
      ['달 밝기', `${illuminationPct}%`, true],
    ];
    ctx.textBaseline = 'alphabetic';
    rows.forEach(([label, val, accent], idx) => {
      const ry = y + 42 + idx * 30 + (accent ? 6 : 0);
      if (accent) {
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 17);
        ctx.lineTo(rightEnd, ry - 17);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      ctx.font = `500 11.5px ${FONT}`;
      ctx.fillText(label, rx, ry);

      ctx.textAlign = 'right';
      ctx.fillStyle = accent ? '#93C5FD' : '#FFFFFF';
      ctx.font = `${accent ? 800 : 700} 12px ${FONT}`;
      ctx.fillText(val, rightEnd, ry);
    });

    ctx.restore();
    return;
  }

  // 4. 획수 계산
  if (theory.id === 'numerology') {
    const padX = x + 16;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('문장 획수 집계', padX, y + 25);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#191F28';
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(`총 ${sentence.totalStrokes}획`, x + w - 16, y + 25);

    // Sentence syllable pills
    let cx = padX;
    const chipY = y + 38;
    const shown = sentence.syllables.slice(0, 7);
    ctx.textBaseline = 'middle';
    shown.forEach((s) => {
      const cw = 39;
      if (cx + cw <= x + w - 42) {
        fillRoundRect(ctx, cx, chipY, cw, 26, 8, '#FFFFFF');
        ctx.textAlign = 'left';
        ctx.fillStyle = '#191F28';
        ctx.font = `700 11.5px ${FONT}`;
        ctx.fillText(s.char, cx + 8, chipY + 13.5);
        ctx.fillStyle = '#8B95A1';
        ctx.font = `600 10px ${FONT}`;
        ctx.fillText(String(s.totalStrokes), cx + 23, chipY + 14);
        cx += cw + 5;
      }
    });
    if (sentence.syllables.length > 7) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8B95A1';
      ctx.font = `600 10.5px ${FONT}`;
      ctx.fillText(`+${sentence.syllables.length - 7}`, cx + 2, chipY + 13.5);
    }

    // Divider
    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + 78);
    ctx.lineTo(x + w - 16, y + 78);
    ctx.stroke();

    // Menu match row
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('계산 결과', padX, y + 104);

    let mx = x + w - 16;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `800 12px ${FONT}`;
    const eqText = `= ${menuAnalysis.totalStrokes}획`;
    ctx.fillText(eqText, mx, y + 104);
    mx -= ctx.measureText(eqText).width + 8;

    const revMenu = [...menuAnalysis.syllables].reverse();
    revMenu.forEach((ms) => {
      const cw = 38;
      mx -= cw;
      if (mx >= padX + 54) {
        fillRoundRect(ctx, mx, y + 91, cw, 26, 8, '#E8F3FF');
        ctx.textAlign = 'left';
        ctx.fillStyle = '#3182F6';
        ctx.font = `700 11.5px ${FONT}`;
        ctx.fillText(ms.char, mx + 7, y + 104.5);
        ctx.font = `600 10px ${FONT}`;
        ctx.fillText(String(ms.totalStrokes), mx + 22, y + 105);
      }
      mx -= 5;
    });

    ctx.restore();
    return;
  }

  // 5. 키보드 동선
  if (theory.id === 'keyboard') {
    const keyW = 28;
    const keyH = 26;
    const gap = 4.5;
    const offsetX = x + 19;
    const offsetY = y + 20;

    const toCoord = (xMm: number, yMm: number) => ({
      px: offsetX + (xMm / 19.05) * (keyW + gap) + keyW / 2,
      py: offsetY + (yMm / 19.05) * (keyH + gap) + keyH / 2,
    });

    const pressedSet = new Set(sentence.keystrokes.map((k) => k.jamo));
    const menuKeySet = new Set(menuAnalysis.keystrokes.map((k) => k.jamo));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    DUBEOLSIK_LAYOUT.forEach((k) => {
      const kx = offsetX + k.col * (keyW + gap);
      const ky = offsetY + k.row * (keyH + gap);
      const isMenu = menuKeySet.has(k.jamo);
      const isPressed = pressedSet.has(k.jamo);
      fillRoundRect(ctx, kx, ky, keyW, keyH, 6.5, isMenu ? '#3182F6' : isPressed ? '#DCE1E7' : '#FFFFFF');
      ctx.fillStyle = isMenu ? '#FFFFFF' : '#191F28';
      ctx.font = `${isMenu || isPressed ? 700 : 500} 10px ${FONT}`;
      ctx.fillText(k.jamo, kx + keyW / 2, ky + keyH / 2 + 0.5);
    });

    if (sentence.keystrokes.length > 1) {
      ctx.strokeStyle = 'rgba(49, 130, 246, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      sentence.keystrokes.slice(0, 28).forEach((k, idx) => {
        const pt = toCoord(k.xMm, k.yMm);
        if (idx === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      });
      ctx.stroke();
    }

    const sc = toCoord(sentence.centroidMm.x, sentence.centroidMm.y);
    const mc = toCoord(menuAnalysis.centroidMm.x, menuAnalysis.centroidMm.y);

    ctx.save();
    ctx.setLineDash([3, 2.5]);
    ctx.strokeStyle = '#191F28';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sc.px, sc.py);
    ctx.lineTo(mc.px, mc.py);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(49, 130, 246, 0.25)';
    ctx.strokeStyle = '#3182F6';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(sc.px, sc.py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3182F6';
    ctx.beginPath();
    ctx.arc(sc.px, sc.py, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#191F28';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mc.px, mc.py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    return;
  }

  // 6. 글자 별자리 (밤하늘 다크 카드)
  if (theory.id === 'constellation' && proof.constellation) {
    const { stars, constellationName } = proof.constellation;
    const pts = stars.map((st) => ({
      ...st,
      sx: x + (st.x / 100) * w,
      sy: y + (st.y / 100) * h,
    }));

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h - 22);
    ctx.lineTo(x + w - 20, y + h - 22);
    ctx.moveTo(x + 20, y + 20);
    ctx.lineTo(x + 20, y + h - 22);
    ctx.stroke();

    if (pts.length > 1) {
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 1.7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      });
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    pts.forEach((p) => {
      ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `600 10.5px ${FONT}`;
      ctx.fillText(p.char, p.sx, p.sy - 10);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#93C5FD';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`★ ${constellationName}`, x + w - 16, y + 24);

    ctx.restore();
    return;
  }

  // 7. 받침 리듬파
  if (theory.id === 'morse' && proof.morse) {
    const { beats, bpm, menuPatternText } = proof.morse;
    const padX = x + 16;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('음절 리듬 파형', padX, y + 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`${bpm} BPM · 리듬 일치`, x + w - 16, y + 24);

    const count = Math.max(1, beats.length);
    const availW = w - 32;
    const colW = availW / count;
    const barW = Math.min(14, colW * 0.55);
    const barBottom = y + 84;
    const maxBarH = 44;

    ctx.textAlign = 'center';
    beats.forEach((b, idx) => {
      const cx = padX + colW * idx + colW / 2;
      const bh = Math.max(10, Math.round(b.amplitude * maxBarH));
      fillRoundRect(
        ctx,
        cx - barW / 2,
        barBottom - bh,
        barW,
        bh,
        barW / 2,
        b.isLong ? '#3182F6' : '#191F28'
      );
      ctx.fillStyle = '#191F28';
      ctx.font = `700 10px ${FONT}`;
      ctx.fillText(b.char, cx, barBottom + 13);
    });

    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + h - 28);
    ctx.lineTo(x + w - 16, y + h - 28);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 10.5px ${FONT}`;
    ctx.fillText('메뉴 리듬', padX, y + h - 11);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(menuPatternText, x + w - 16, y + h - 11);

    ctx.restore();
    return;
  }

  // 8. 원소 조합
  if (theory.id === 'periodic' && proof.periodicTerms) {
    const terms = proof.periodicTerms.slice(0, 3);
    const cardW = 54;
    const cardH = 62;
    const resW = 74;
    const gap = 16;
    const totalW = terms.length * cardW + (terms.length - 1) * gap + gap + resW;
    let cx = x + (w - totalW) / 2;
    const cy = y + (h - cardH) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    terms.forEach((t, idx) => {
      if (idx > 0) {
        ctx.fillStyle = '#8B95A1';
        ctx.font = `700 13px ${FONT}`;
        ctx.fillText('+', cx - gap / 2, cy + cardH / 2 + 4);
      }
      fillRoundRect(ctx, cx, cy, cardW, cardH, 11, '#FFFFFF');
      ctx.fillStyle = '#8B95A1';
      ctx.font = `600 9.5px ${FONT}`;
      ctx.fillText(String(t.atomicNumber), cx + cardW / 2, cy + 16);
      ctx.fillStyle = '#191F28';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(t.symbol, cx + cardW / 2, cy + 37);
      ctx.fillStyle = '#4E5968';
      ctx.font = `500 9.5px ${FONT}`;
      const chunk = t.sourceChunk.length > 4 ? `${t.sourceChunk.slice(0, 3)}…` : t.sourceChunk;
      ctx.fillText(chunk, cx + cardW / 2, cy + 53);
      cx += cardW + gap;
    });

    ctx.fillStyle = '#3182F6';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText('→', cx - gap / 2, cy + cardH / 2 + 4);

    fillRoundRect(ctx, cx, cy, resW, cardH, 11, '#3182F6');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 9.5px ${FONT}`;
    ctx.fillText(`${menuAnalysis.totalStrokes}획`, cx + resW / 2, cy + 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${menu.name.length >= 5 ? 11.5 : menu.name.length >= 4 ? 13 : 15}px ${FONT}`;
    ctx.fillText(menu.name, cx + resW / 2, cy + 37);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `500 9.5px ${FONT}`;
    ctx.fillText('완성', cx + resW / 2, cy + 53);

    ctx.restore();
    return;
  }

  // 9. 유니코드
  if (theory.id === 'unicode' && proof.unicodeFactors) {
    const shown = sentence.syllables.slice(0, 6);
    const { sumHex, digitSum, modulus } = proof.unicodeFactors;
    const padX = x + 16;
    const chipW = 104;
    const chipH = 27;
    const gapX = 8;
    const gapY = 7;

    ctx.textBaseline = 'middle';
    shown.forEach((s, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = padX + col * (chipW + gapX);
      const cy = y + 18 + row * (chipH + gapY);
      fillRoundRect(ctx, cx, cy, chipW, chipH, 8, '#FFFFFF');
      ctx.textAlign = 'left';
      ctx.fillStyle = '#191F28';
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText(s.char, cx + 10, cy + chipH / 2 + 0.5);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8B95A1';
      ctx.font = `600 10px ${FONT}`;
      ctx.fillText(s.hex, cx + chipW - 10, cy + chipH / 2 + 0.5);
    });

    ctx.strokeStyle = '#E5E8EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y + h - 32);
    ctx.lineTo(x + w - 16, y + h - 32);
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(`합계 ${sumHex} · 자릿수 합 ${digitSum}`, padX, y + h - 13);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `700 11px ${FONT}`;
    ctx.fillText(`고유수 ${modulus}`, x + w - 16, y + h - 13);

    ctx.restore();
    return;
  }

  // 10. 말투 온도
  if (theory.id === 'thermodynamics' && proof.thermoMetrics) {
    const { excitationPct, yangPct, yinPct } = proof.thermoMetrics;
    const neutralPct = Math.max(0, 100 - yangPct - yinPct);
    const padX = x + 18;
    const barW = w - 36;
    const barY = y + h / 2 + 6;
    const barH = 12;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4E5968';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`밝은 모음 ${yangPct}% · 어두운 모음 ${yinPct}%`, padX, barY - 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#3182F6';
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText(`${excitationPct}°`, x + w - 18, barY - 14);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(padX, barY, barW, barH, 6);
    ctx.clip();

    const wYang = (Math.max(8, yangPct) / 100) * barW;
    const wYin = (Math.max(8, yinPct) / 100) * barW;
    const wNeu = Math.max(0, (neutralPct / 100) * barW);
    const totalSeg = wYang + wNeu + wYin || barW;
    const scaleX = barW / totalSeg;

    ctx.fillStyle = '#3182F6';
    ctx.fillRect(padX, barY, wYang * scaleX, barH);
    ctx.fillStyle = '#DFE3E8';
    ctx.fillRect(padX + wYang * scaleX, barY, wNeu * scaleX, barH);
    ctx.fillStyle = '#191F28';
    ctx.fillRect(padX + (wYang + wNeu) * scaleX, barY, wYin * scaleX, barH);
    ctx.restore();
  }

  ctx.restore();
}

export function renderProofCertificatePng(proof: ProofResult): string {
  const scale = 2;
  const width = 460;
  const pad = 22;
  const cardW = width - pad * 2;
  const innerX = pad + 26;
  const innerW = cardW - 52;
  const visualH = proof.theory.id === 'thermodynamics' ? 96 : 134;

  // Measure dynamic text height on scratch context so bottom padding is always perfectly balanced
  const scratch = document.createElement('canvas');
  const mCtx = scratch.getContext('2d');
  if (!mCtx) return '';

  mCtx.font = `500 13px ${FONT}`;
  const leadLines = wrapLines(mCtx, proof.theoremTitle, innerW).slice(0, 2);

  const measuredSteps = proof.steps.map((step) => {
    mCtx.font = `700 12.5px ${FONT}`;
    const fLines = wrapLines(mCtx, step.formula, innerW - 32).slice(0, 2);
    mCtx.font = `500 11.5px ${FONT}`;
    const dLines = wrapLines(mCtx, step.explanation, innerW - 32).slice(0, 2);
    return { step, fLines, dLines };
  });

  // Compute exact total card height (zero bottom watermark/footer line!)
  let contentH = 28; // top card padding
  contentH += 34; // user prompt bubble
  contentH += 20; // gap
  contentH += 34; // big headline
  contentH += leadLines.length * 18; // summary
  contentH += 16; // gap before visual stage
  contentH += visualH; // motion graphic final frame!
  contentH += 24; // gap before steps
  measuredSteps.forEach((ms, idx) => {
    contentH += ms.fLines.length * 17 + ms.dLines.length * 16 + (idx < measuredSteps.length - 1 ? 14 : 0);
  });
  contentH += 28; // clean symmetric bottom card padding

  const height = pad * 2 + contentH;
  const cardH = contentH;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  // Soft outer backdrop
  ctx.fillStyle = '#F2F4F6';
  ctx.fillRect(0, 0, width, height);

  // Elevated pure-white rounded card
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, cardH, 24);
  ctx.fill();
  ctx.restore();

  let y = pad + 28;

  // 1. User's right-aligned prompt bubble
  const quoteText =
    proof.sentence.trimmed.length > 26
      ? `${proof.sentence.trimmed.slice(0, 26)}…`
      : proof.sentence.trimmed;
  ctx.font = `500 12.5px ${FONT}`;
  const qw = Math.min(innerW, ctx.measureText(quoteText).width + 28);
  fillRoundRect(ctx, innerX + innerW - qw, y, qw, 34, 17, '#F2F4F6');

  ctx.fillStyle = '#191F28';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(quoteText, innerX + innerW - 14, y + 17.5);
  y += 34 + 20;

  // 2. Colored Menu Headline + Summary
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // "오늘은 " + blue menu.name + "이네요/네요"
  const prefix = '오늘은 ';
  const menuTxt = proof.menu.name;
  const suffix = josa(proof.menu.name, '이네요', '네요');
  ctx.font = `800 26px ${FONT}`;
  const headlineY = y + 26;
  ctx.fillStyle = '#191F28';
  ctx.fillText(prefix, innerX, headlineY);
  const w1 = ctx.measureText(prefix).width;
  ctx.fillStyle = '#3182F6';
  ctx.fillText(menuTxt, innerX + w1, headlineY);
  const w2 = ctx.measureText(menuTxt).width;
  ctx.fillStyle = '#191F28';
  ctx.fillText(suffix, innerX + w1 + w2, headlineY);
  y += 34 + 6;

  ctx.fillStyle = '#4E5968';
  ctx.font = `500 13px ${FONT}`;
  leadLines.forEach((ln) => {
    ctx.fillText(ln, innerX, y + 11);
    y += 18;
  });

  // 3. Motion-Graphic Result Stage!
  y += 12;
  drawVisualStage(ctx, proof, innerX, y, innerW, visualH);
  y += visualH + 24;

  // 4. Clean 3-Step Breakdown
  measuredSteps.forEach(({ step, fLines, dLines }, idx) => {
    const isLast = idx === measuredSteps.length - 1;
    const badgeY = y + 6;

    ctx.fillStyle = isLast ? '#E8F3FF' : '#F2F4F6';
    ctx.beginPath();
    ctx.arc(innerX + 11, badgeY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isLast ? '#3182F6' : '#4E5968';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(step.label, innerX + 11, badgeY + 0.5);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#191F28';
    ctx.font = `700 12.5px ${FONT}`;
    fLines.forEach((fl) => {
      ctx.fillText(fl, innerX + 32, y + 10);
      y += 17;
    });

    ctx.fillStyle = '#6B7684';
    ctx.font = `500 11.5px ${FONT}`;
    dLines.forEach((dl) => {
      ctx.fillText(dl, innerX + 32, y + 10);
      y += 16;
    });

    if (idx < measuredSteps.length - 1) {
      y += 14;
    }
  });

  return canvas.toDataURL('image/png');
}
