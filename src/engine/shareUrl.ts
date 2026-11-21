import { LiveWorldData, TheoryId } from '../types/menu';
import { decodeClockContext, encodeClockContext, THEORY_ORDER } from './hangulMath';
import {
  createInitialLiveData,
  decodeMoonParam,
  decodeWeatherParam,
  encodeMoonParam,
  encodeWeatherParam,
} from './liveData';

export interface SharedProofParams {
  text: string;
  theoryId: TheoryId;
  menuName: string;
  variantSeed: number;
  liveData: LiveWorldData;
}

const VALID_THEORY_SET = new Set<string>(THEORY_ORDER);

function sanitizePlainText(raw: string, maxLen: number): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Construct a clean shareable URL using URL + URLSearchParams so Hangul, live weather/FX/moon
 * snapshots, and symbols encode safely and reproduce the exact same proof later.
 */
export function buildShareUrl(params: {
  text: string;
  theoryId: TheoryId;
  menuName: string;
  variantSeed: number;
  liveData: LiveWorldData;
}): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('q', sanitizePlainText(params.text, 120));
  url.searchParams.set('t', params.theoryId);
  url.searchParams.set('m', sanitizePlainText(params.menuName, 24));
  url.searchParams.set('d', encodeClockContext(params.liveData.clock));
  url.searchParams.set('w', encodeWeatherParam(params.liveData.weather));
  url.searchParams.set('x', String(params.liveData.fx.usdKrw));
  url.searchParams.set('l', encodeMoonParam(params.liveData.moon));
  if (params.variantSeed > 0) {
    url.searchParams.set('s', String(Math.min(9999, Math.floor(params.variantSeed))));
  }
  return url.toString();
}

/**
 * Parse shared proof parameters from a query string via URLSearchParams.
 */
export function parseShareUrl(search: string): SharedProofParams | null {
  const params = new URLSearchParams(search);
  const text = sanitizePlainText(params.get('q') ?? '', 120);
  const theoryRaw = (params.get('t') ?? '').trim();
  const menuName = sanitizePlainText(params.get('m') ?? '', 24);
  const seedRaw = (params.get('s') ?? '0').trim();

  if (!text || !menuName || !VALID_THEORY_SET.has(theoryRaw)) {
    return null;
  }

  const parsedSeed = Number.parseInt(seedRaw, 10);
  const variantSeed =
    Number.isFinite(parsedSeed) && parsedSeed >= 0 ? Math.min(9999, parsedSeed) : 0;

  const baseLive = createInitialLiveData();
  const parsedClock = decodeClockContext(params.get('d'));
  const parsedWeather = decodeWeatherParam(params.get('w'));
  const parsedFxRaw = Number.parseInt(params.get('x') ?? '', 10);
  const parsedMoon = decodeMoonParam(params.get('l'));

  const liveData: LiveWorldData = {
    clock: parsedClock ?? baseLive.clock,
    weather: parsedWeather ?? baseLive.weather,
    fx:
      Number.isFinite(parsedFxRaw) && parsedFxRaw > 500 && parsedFxRaw < 5000
        ? { usdKrw: parsedFxRaw, isLive: true }
        : baseLive.fx,
    moon: parsedMoon ?? baseLive.moon,
  };

  return {
    text: text.slice(0, 120),
    theoryId: theoryRaw as TheoryId,
    menuName: menuName.slice(0, 24),
    variantSeed,
    liveData,
  };
}

function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement('textarea'), { value: text });
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export async function copyTextWithFallback(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacyCopy
  }
  return legacyCopy(text);
}
