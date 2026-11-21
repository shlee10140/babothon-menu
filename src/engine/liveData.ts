import {
  ClockContext,
  LiveFxData,
  LiveMoonData,
  LiveWeatherData,
  LiveWorldData,
} from '../types/menu';
import { getNowClockContext } from './hangulMath';

const SYNODIC_MONTH = 29.53058867;
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/**
 * Pure real-time astronomical lunar phase calculation (accurate offline & online).
 */
export function computeMoonPhase(now = new Date()): LiveMoonData {
  const daysSince = (now.getTime() - KNOWN_NEW_MOON_MS) / 86_400_000;
  const cyclePos = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phaseRatio = cyclePos / SYNODIC_MONTH; // 0 = new, 0.5 = full
  const illuminationPct = Math.round(((1 - Math.cos(phaseRatio * Math.PI * 2)) / 2) * 100);
  const lunarDay = Math.max(1, Math.min(30, Math.floor(cyclePos) + 1));

  let phaseName = '초승달';
  if (phaseRatio < 0.04 || phaseRatio >= 0.96) phaseName = '그믐달';
  else if (phaseRatio < 0.21) phaseName = '초승달';
  else if (phaseRatio < 0.29) phaseName = '상현달';
  else if (phaseRatio < 0.46) phaseName = '차오르는 달';
  else if (phaseRatio < 0.54) phaseName = '보름달';
  else if (phaseRatio < 0.71) phaseName = '기우는 달';
  else if (phaseRatio < 0.79) phaseName = '하현달';
  else phaseName = '그믐달';

  return {
    illuminationPct,
    lunarDay,
    phaseRatio,
    phaseName,
  };
}

export function describeWmoWeather(
  code: number
): { label: string; icon: 'sun' | 'partly' | 'cloud' | 'rain' | 'snow' } {
  if (code === 0) return { label: '맑음', icon: 'sun' };
  if (code <= 2) return { label: '대체로 맑음', icon: 'partly' };
  if (code === 3 || (code >= 45 && code <= 48)) return { label: '흐림', icon: 'cloud' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: '눈', icon: 'snow' };
  }
  if (code >= 51) return { label: '비', icon: 'rain' };
  return { label: '구름 조금', icon: 'partly' };
}

function seasonalFallbackTemp(month: number): number {
  const byMonth = [0, 1, 4, 9, 15, 20, 24, 27, 28, 23, 16, 9, 3];
  return byMonth[month] ?? 14;
}

export function createInitialLiveData(now = new Date()): LiveWorldData {
  const clock = getNowClockContext(now);
  return {
    clock,
    weather: {
      tempC: seasonalFallbackTemp(clock.month),
      humidity: 54,
      windKmh: 5.2,
      weatherCode: 1,
      isLive: false,
    },
    fx: {
      usdKrw: 1395,
      isLive: false,
    },
    moon: computeMoonPhase(now),
  };
}

const WEATHER_ENDPOINT =
  'https://api.open-meteo.com/v1/forecast?latitude=35.8888&longitude=128.6103&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FSeoul';
const FX_ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

/**
 * Fetch real-time live weather (Open-Meteo) & USD/KRW rate (Open ER-API) silently in parallel
 * with declarative AbortSignal.timeout so slow/offline networks never stall the UI.
 */
export async function fetchLiveFeeds(): Promise<{
  weather?: LiveWeatherData;
  fx?: LiveFxData;
}> {
  const fetchInit: RequestInit = {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  };

  const [weatherRes, fxRes] = await Promise.allSettled([
    fetch(WEATHER_ENDPOINT, { ...fetchInit, signal: AbortSignal.timeout(4500) }).then((r) => {
      if (!r.ok) throw new Error(`Weather HTTP ${r.status}`);
      return r.json();
    }),
    fetch(FX_ENDPOINT, { ...fetchInit, signal: AbortSignal.timeout(4500) }).then((r) => {
      if (!r.ok) throw new Error(`FX HTTP ${r.status}`);
      return r.json();
    }),
  ]);

  const result: { weather?: LiveWeatherData; fx?: LiveFxData } = {};

  if (weatherRes.status === 'fulfilled' && weatherRes.value?.current) {
    const cur = weatherRes.value.current;
    const tempC = Number(cur.temperature_2m);
    const humidity = Number(cur.relative_humidity_2m);
    const windKmh = Number(cur.wind_speed_10m);
    const weatherCode = Number(cur.weather_code);
    if (Number.isFinite(tempC) && Number.isFinite(humidity)) {
      result.weather = {
        tempC: Number(tempC.toFixed(1)),
        humidity: Math.max(0, Math.min(100, Math.round(humidity))),
        windKmh: Number.isFinite(windKmh) ? Number(windKmh.toFixed(1)) : 4.0,
        weatherCode: Number.isFinite(weatherCode) ? weatherCode : 1,
        isLive: true,
      };
    }
  }

  if (fxRes.status === 'fulfilled' && fxRes.value?.rates?.KRW) {
    const krw = Math.round(Number(fxRes.value.rates.KRW));
    if (Number.isFinite(krw) && krw > 500 && krw < 5000) {
      result.fx = {
        usdKrw: krw,
        isLive: true,
      };
    }
  }

  return result;
}

export function encodeWeatherParam(w: LiveWeatherData): string {
  return `${Math.round(w.tempC * 10)}_${w.humidity}_${Math.round(w.windKmh * 10)}_${w.weatherCode}`;
}

export function decodeWeatherParam(raw: string | null | undefined): LiveWeatherData | null {
  if (!raw) return null;
  const parts = raw.split('_').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [t10, hum, w10, code] = parts;
  if (t10 < -500 || t10 > 600 || hum < 0 || hum > 100) return null;
  return {
    tempC: Number((t10 / 10).toFixed(1)),
    humidity: hum,
    windKmh: Math.max(0, Number((w10 / 10).toFixed(1))),
    weatherCode: code,
    isLive: true,
  };
}

export function encodeMoonParam(m: LiveMoonData): string {
  return `${m.illuminationPct}_${m.lunarDay}_${Math.round(m.phaseRatio * 100)}`;
}

export function decodeMoonParam(raw: string | null | undefined): LiveMoonData | null {
  if (!raw) return null;
  const parts = raw.split('_').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [pct, day, ratio100] = parts;
  if (pct < 0 || pct > 100 || day < 1 || day > 30 || ratio100 < 0 || ratio100 > 100) return null;
  const phaseRatio = ratio100 / 100;
  let phaseName = '초승달';
  if (phaseRatio < 0.04 || phaseRatio >= 0.96) phaseName = '그믐달';
  else if (phaseRatio < 0.21) phaseName = '초승달';
  else if (phaseRatio < 0.29) phaseName = '상현달';
  else if (phaseRatio < 0.46) phaseName = '차오르는 달';
  else if (phaseRatio < 0.54) phaseName = '보름달';
  else if (phaseRatio < 0.71) phaseName = '기우는 달';
  else if (phaseRatio < 0.79) phaseName = '하현달';
  else phaseName = '그믐달';
  return { illuminationPct: pct, lunarDay: day, phaseRatio, phaseName };
}

export function mergeClockIntoLive(base: LiveWorldData, clock: ClockContext): LiveWorldData {
  return { ...base, clock };
}
