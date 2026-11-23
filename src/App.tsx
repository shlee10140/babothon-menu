import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LiveWorldData, MenuItem, TheoryId } from './types/menu';
import {
  DEFAULT_MENUS,
  getNowClockContext,
  HomePromptSet,
  pickHomePromptSet,
} from './engine/hangulMath';
import { computeMoonPhase, createInitialLiveData, fetchLiveFeeds } from './engine/liveData';
import { generateProof, josa, pickFreshTheoryAndMenu } from './engine/proofEngine';
import { buildShareUrl, parseShareUrl } from './engine/shareUrl';
import {
  loadSoundPreference,
  playPhaseSound,
  playToggleOnSound,
  saveSoundPreference,
  unlockAudio,
} from './engine/soundEngine';
import { ProofMotionStage } from './components/ProofMotionStage';
import {
  CinemaTimingPlan,
  computeCinemaTiming,
  DeductionCinemaBar,
} from './components/DeductionCinemaBar';
import { MenuPoolDialog } from './components/MenuPoolDialog';
import { CertificateDialog } from './components/CertificateDialog';

type ViewMode = 'home' | 'result';
type MotionPhase = 1 | 2 | 3 | 4;

interface InitialBootstrap {
  view: ViewMode;
  draftText: string;
  submittedText: string;
  menus: MenuItem[];
  activeTheoryId: TheoryId;
  activeMenuId: string;
  variantSeed: number;
  liveData: LiveWorldData;
  runKey: number;
}

const EARLY_REROLL_NUDGES = [
  '아까 건 패스하신 거죠? 이번 건 좀 어떠세요.',
  '음, 취향이 꽤 확고하신 편이네요.',
  '이 정도면 슬슬 하나쯤 걸릴 만도 한데요.',
  '방금 건 못 본 걸로 하고 다시 뽑아봤어요.',
  '은근히 까다로우시네요. 이건 어때요?',
  '잠깐 고민하다 넘기신 거 다 압니다.',
  '이번엔 진짜 괜찮은 것 같은데, 또 넘기시려나요.',
  '이쯤 되면 그냥 이거 드셔도 될 것 같은데요.',
];

const LATE_REROLL_NUDGES = [
  '솔직히 이미 마음속에 정해둔 메뉴 있으시죠?',
  '그냥 그거 드시지… 왜 저한테 확인받으려고 하세요.',
  '이쯤 되면 메뉴 고르는 게 아니라 버튼 누르는 재미로 하시는 거죠?',
  '네, 또 뽑아드렸습니다. 이번에도 넘기실 거죠?',
  '지금쯤이면 배고파서 뭘 먹어도 맛있을 텐데요.',
  '슬슬 제일 처음 나왔던 게 제일 나아 보이기 시작할 타이밍이에요.',
  '이 정도 돌렸으면 그냥 마음 가는 거 드셔도 아무도 뭐라 안 해요.',
  '혹시 500개 구경하러 오신 건 아니죠?',
  '알겠습니다, 마음에 드는 거 나올 때까지 뽑아드릴게요.',
  '계속 넘기시는 걸 보니 답은 이미 정해져 있는 것 같네요.',
  '이거 넘기시면 아까 나왔던 거보다 나을 보장은 없어요.',
  '방금 또 손가락이 다시 찾기로 가려는 거 보였어요.',
  '오늘 안에 식사하실 계획은 있으신 거죠?',
  '괜히 눈치 보지 마시고 먹고 싶은 거 직접 넣어보세요.',
];

function pickFreshNudge(pool: string[], recent: string[]): string {
  const candidates = pool.filter((line) => !recent.includes(line));
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}

function getInitialBootstrap(): InitialBootstrap {
  const baseMenus = DEFAULT_MENUS.map((m) => ({ ...m }));
  const nowLive = createInitialLiveData();
  const shared =
    typeof window !== 'undefined' ? parseShareUrl(window.location.search) : null;

  if (!shared) {
    return {
      view: 'home',
      draftText: '',
      submittedText: '',
      menus: baseMenus,
      activeTheoryId: 'conspiracy',
      activeMenuId: baseMenus[0].id,
      variantSeed: 0,
      liveData: nowLive,
      runKey: 0,
    };
  }

  const matched = baseMenus.find((m) => m.name === shared.menuName);
  let menus = baseMenus;
  let activeMenuId: string;

  if (matched) {
    matched.enabled = true;
    activeMenuId = matched.id;
  } else {
    const sharedItem: MenuItem = {
      id: 'shared-custom',
      name: shared.menuName,
      category: '공유됨',
      zone: '',
      enabled: true,
      isCustom: true,
    };
    menus = [sharedItem, ...baseMenus];
    activeMenuId = sharedItem.id;
  }

  return {
    view: 'result',
    draftText: shared.text,
    submittedText: shared.text,
    menus,
    activeTheoryId: shared.theoryId,
    activeMenuId,
    variantSeed: shared.variantSeed,
    liveData: shared.liveData,
    runKey: 1,
  };
}

export const App: React.FC = () => {
  const [initial] = useState<InitialBootstrap>(() => getInitialBootstrap());

  const [view, setView] = useState<ViewMode>(initial.view);
  const [draftText, setDraftText] = useState(initial.draftText);
  const [submittedText, setSubmittedText] = useState(initial.submittedText);
  const [menus, setMenus] = useState<MenuItem[]>(initial.menus);

  const [activeTheoryId, setActiveTheoryId] = useState<TheoryId>(initial.activeTheoryId);
  const [activeMenuId, setActiveMenuId] = useState<string>(initial.activeMenuId);
  const [variantSeed, setVariantSeed] = useState(initial.variantSeed);
  const [liveData, setLiveData] = useState<LiveWorldData>(initial.liveData);
  const latestLiveRef = useRef<LiveWorldData>(initial.liveData);
  const [runKey, setRunKey] = useState(initial.runKey);
  const [cinemaTiming, setCinemaTiming] = useState<CinemaTimingPlan>(() =>
    computeCinemaTiming(
      initial.submittedText || '오늘 뭐 먹지',
      initial.activeTheoryId,
      initial.menus.filter((m) => m.enabled).length
    )
  );
  const cinemaTimingRef = useRef<CinemaTimingPlan>(cinemaTiming);
  cinemaTimingRef.current = cinemaTiming;
  const rerollCountRef = useRef(0);
  const recentNudgesRef = useRef<string[]>([]);
  const [rerollNudge, setRerollNudge] = useState<{
    key: number;
    text: string;
    showAddHint: boolean;
  } | null>(null);
  const [homePrompts, setHomePrompts] = useState<HomePromptSet>(() =>
    pickHomePromptSet(initial.liveData)
  );
  const [stepsOpen, setStepsOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 641px)').matches : true
  );
  const [phase, setPhase] = useState<MotionPhase>(initial.view === 'result' ? 1 : 4);
  const phaseTimersRef = useRef<number[]>([]);

  const clearPhaseTimers = useCallback(() => {
    phaseTimersRef.current.forEach((id) => window.clearTimeout(id));
    phaseTimersRef.current = [];
  }, []);

  const [soundOn, setSoundOn] = useState<boolean>(() => loadSoundPreference());
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const activeTheoryRef = useRef<TheoryId>(activeTheoryId);
  activeTheoryRef.current = activeTheoryId;

  const recentTheoriesRef = useRef<TheoryId[]>(
    initial.view === 'result' ? [initial.activeTheoryId] : []
  );
  const recentMenuIdsRef = useRef<string[]>(
    initial.view === 'result' ? [initial.activeMenuId] : []
  );

  const [poolOpen, setPoolOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const lastToastRef = useRef('');
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((rawMsg: string) => {
    // Append a no-break space on identical consecutive messages so VoiceOver re-announces them
    let msg = rawMsg;
    if (msg === lastToastRef.current) {
      msg = `${rawMsg}\u00A0`;
    }
    lastToastRef.current = msg;
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Silently hydrate real-time weather (Open-Meteo) & USD/KRW rate (Open ER-API) in background
  useEffect(() => {
    let active = true;
    void fetchLiveFeeds().then((feeds) => {
      if (!active) return;
      const merged: LiveWorldData = {
        ...latestLiveRef.current,
        weather: feeds.weather ?? latestLiveRef.current.weather,
        fx: feeds.fx ?? latestLiveRef.current.fx,
      };
      latestLiveRef.current = merged;
      // Only update active liveData immediately on Home so an open shared link stays frozen to its URL snapshot
      if (initial.view === 'home') {
        setLiveData(merged);
      }
    });
    return () => {
      active = false;
    };
  }, [initial.view]);

  const proof = useMemo(
    () =>
      generateProof(
        submittedText || '오늘 뭐 먹지',
        menus,
        activeTheoryId,
        activeMenuId,
        variantSeed,
        liveData
      ),
    [submittedText, menus, activeTheoryId, activeMenuId, variantSeed, liveData]
  );

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return buildShareUrl({
      text: proof.sentence.trimmed,
      theoryId: proof.theory.id,
      menuName: proof.menu.name,
      variantSeed,
      liveData,
    });
  }, [proof.sentence.trimmed, proof.theory.id, proof.menu.name, variantSeed, liveData]);

  // Keep browser URL & document title cleanly synchronized with current view
  useEffect(() => {
    if (view === 'result') {
      document.title = `${proof.menu.name} · 난 진짜 다 좋아`;
      try {
        window.history.replaceState(null, '', shareUrl);
      } catch {
        // Ignore history restrictions in sandboxed environments
      }
    } else {
      document.title = '난 진짜 다 좋아';
      if (window.location.search) {
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {
          // Ignore
        }
      }
    }
  }, [view, shareUrl, proof.menu.name]);

  // Drive the dynamic workload-proportional 4-Act kinetic deduction choreography + Web Audio cues
  useEffect(() => {
    clearPhaseTimers();
    if (view !== 'result' || runKey === 0) return;
    const theoryForRun = activeTheoryRef.current;
    const timing = cinemaTimingRef.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase(4);
      playPhaseSound(4, theoryForRun, soundOnRef.current);
      return;
    }

    setPhase(1);
    playPhaseSound(1, theoryForRun, soundOnRef.current);

    const t2 = window.setTimeout(() => {
      setPhase(2);
      playPhaseSound(2, theoryForRun, soundOnRef.current);
    }, timing.act1Ms);

    const t3 = window.setTimeout(() => {
      setPhase(3);
      playPhaseSound(3, theoryForRun, soundOnRef.current);
    }, timing.act1Ms + timing.act2Ms);

    const t4 = window.setTimeout(() => {
      setPhase(4);
      playPhaseSound(4, theoryForRun, soundOnRef.current);
    }, timing.totalMs);

    phaseTimersRef.current = [t2, t3, t4];

    return () => {
      clearPhaseTimers();
    };
  }, [runKey, view, clearPhaseTimers]);

  const runFreshCalculation = useCallback(
    (text: string, currentMenus: MenuItem[], isReroll = false) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      if (soundOnRef.current) unlockAudio();

      const now = new Date();
      const freshLive: LiveWorldData = {
        clock: getNowClockContext(now),
        weather: latestLiveRef.current.weather,
        fx: latestLiveRef.current.fx,
        moon: computeMoonPhase(now),
      };
      latestLiveRef.current = freshLive;

      const { theoryId, menuId } = pickFreshTheoryAndMenu(
        cleaned,
        currentMenus,
        recentTheoriesRef.current,
        recentMenuIdsRef.current,
        freshLive
      );

      recentTheoriesRef.current = [...recentTheoriesRef.current.slice(-11), theoryId];
      recentMenuIdsRef.current = [...recentMenuIdsRef.current.slice(-120), menuId];
      activeTheoryRef.current = theoryId;

      const enabledCount = currentMenus.filter((m) => m.enabled).length;
      const nextTiming = computeCinemaTiming(cleaned, theoryId, enabledCount, Math.random());
      cinemaTimingRef.current = nextTiming;

      setDraftText(cleaned);
      setSubmittedText(cleaned);
      setActiveTheoryId(theoryId);
      setActiveMenuId(menuId);
      setLiveData(freshLive);
      setCinemaTiming(nextTiming);
      setVariantSeed((s) => s + 1);
      if (isReroll) {
        const nextCount = rerollCountRef.current + 1;
        rerollCountRef.current = nextCount;
        const isLate = nextCount >= 3;
        const pool = isLate ? LATE_REROLL_NUDGES : EARLY_REROLL_NUDGES;
        const line = pickFreshNudge(pool, recentNudgesRef.current);
        recentNudgesRef.current = [...recentNudgesRef.current.slice(-10), line];
        setRerollNudge({ key: nextCount, text: line, showAddHint: isLate });
      } else {
        rerollCountRef.current = 0;
        setRerollNudge(null);
      }
      setStepsOpen(
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 641px)').matches : true
      );
      setRunKey((k) => k + 1);
      setView('result');
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runFreshCalculation(draftText, menus, false);
  };

  const handleReroll = () => {
    runFreshCalculation(submittedText, menus, true);
  };

  const handleReplay = () => {
    if (soundOnRef.current) unlockAudio();
    setRunKey((k) => k + 1);
  };

  const handleSkipMotion = () => {
    clearPhaseTimers();
    setPhase(4);
  };

  const handleBackHome = () => {
    rerollCountRef.current = 0;
    setRerollNudge(null);
    setHomePrompts((prev) => pickHomePromptSet(latestLiveRef.current, prev));
    setView('home');
  };

  const handleRefreshSuggestions = () => {
    setHomePrompts((prev) => pickHomePromptSet(latestLiveRef.current, prev));
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    saveSoundPreference(next);
    if (next) {
      playToggleOnSound();
      notify('효과음을 켰어요.');
    } else {
      notify('효과음을 껐어요.');
    }
  };

  const handleToggleMenu = (id: string) => {
    setMenus((prev) => {
      const enabledCount = prev.filter((m) => m.enabled).length;
      return prev.map((m) => {
        if (m.id !== id) return m;
        if (m.enabled && enabledCount <= 1) return m;
        return { ...m, enabled: !m.enabled };
      });
    });
  };

  const handleSetMenusEnabled = (ids: string[], enabled: boolean) => {
    const idSet = new Set(ids);
    setMenus((prev) => {
      const next = prev.map((m) => (idSet.has(m.id) ? { ...m, enabled } : m));
      // Guarantee at least 1 enabled menu remains
      if (next.some((m) => m.enabled)) return next;
      return prev;
    });
  };

  const handleAddMenu = (name: string) => {
    const existing = menus.find((m) => m.name === name);
    if (existing) {
      if (!existing.enabled) {
        setMenus((prev) => prev.map((m) => (m.id === existing.id ? { ...m, enabled: true } : m)));
        notify(`‘${name}’ 후보를 다시 켰어요.`);
      } else {
        notify(`‘${name}’ 메뉴는 이미 후보에 있어요.`);
      }
      return;
    }
    const newId = `custom-${Date.now()}`;
    const newItem: MenuItem = {
      id: newId,
      name,
      category: '직접 추가',
      zone: '',
      enabled: true,
      isCustom: true,
    };
    setMenus((prev) => [newItem, ...prev]);
    notify(`‘${name}’ 메뉴를 후보에 넣었어요.`);
  };

  const handleResetMenus = () => {
    setMenus(DEFAULT_MENUS.map((m) => ({ ...m })));
    recentMenuIdsRef.current = [];
    notify('기본 메뉴로 되돌렸어요.');
  };

  const activeMenuCount = menus.filter((m) => m.enabled).length;

  return (
    <div className="app-root">
      {/* Shared Minimal Navigation Bar */}
      <header className="nav-bar">
        {view === 'home' ? (
          <span className="nav-brand">난 진짜 다 좋아</span>
        ) : (
          <button type="button" className="text-btn" onClick={handleBackHome}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>새로 쓰기</span>
          </button>
        )}

        <div className="nav-right">
          <button
            type="button"
            className="icon-btn"
            aria-label="효과음"
            aria-pressed={soundOn}
            onClick={handleToggleSound}
          >
            {soundOn ? (
              <Volume2 size={17} aria-hidden="true" />
            ) : (
              <VolumeX size={17} aria-hidden="true" />
            )}
          </button>

          <button type="button" className="text-btn" onClick={() => setPoolOpen(true)}>
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span>메뉴 {activeMenuCount}</span>
          </button>

          {view === 'result' && phase === 4 && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCertOpen(true)}
              aria-label="결과 공유하기"
            >
              <Share2 size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* SCREEN 1: Gemini-style Clean Start Screen */}
      {view === 'home' && (
        <main className="home-stage">
          <div className="home-greeting">
            <h1 className="home-title">
              아무 말이나 적어보세요
              <br />
              <span className="home-title-muted">오늘 먹을 메뉴를 찾아드릴게요</span>
            </h1>
          </div>

          <form className="composer-box" onSubmit={handleSubmit}>
            <label htmlFor="home-prompt" className="sr-only">
              아무 문장이나 입력하세요
            </label>
            <input
              id="home-prompt"
              type="text"
              maxLength={120}
              className="composer-input"
              placeholder={`예) ${homePrompts.placeholder}`}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="composer-send"
              disabled={!draftText.trim()}
              aria-label="메뉴 찾기"
            >
              <ArrowUp size={19} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </form>

          <div className="home-suggestions" aria-label="예시 문장 바로 해보기">
            {homePrompts.suggestions.map((sentence) => (
              <button
                key={sentence}
                type="button"
                className="suggestion-chip"
                onClick={() => runFreshCalculation(sentence, menus)}
              >
                {sentence}
              </button>
            ))}
            <button
              type="button"
              className="suggestion-refresh-btn"
              onClick={handleRefreshSuggestions}
              aria-label="다른 예시 문장 보기"
              title="다른 예시 문장 보기"
            >
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          </div>
        </main>
      )}

      {/* SCREEN 2: Animated Calculation & Result Screen */}
      {view === 'result' && (
        <main className="result-stage">
          {/* User's sent prompt bubble */}
          <div className="user-bubble-row">
            <button
              type="button"
              className="user-bubble"
              onClick={handleBackHome}
              title="누르면 문장을 다시 쓸 수 있어요"
            >
              {proof.sentence.trimmed}
            </button>
          </div>

          <section className="answer-section">
            {/* Live Act Headline -> Pops into Concluded Menu Headline in Act 4 */}
            <div className="answer-headline-group">
              {phase < 4 ? (
                <div key={`scan-${runKey}-${phase}`} className="scanning-head">
                  <p className="scanning-status-text">
                    {phase === 1
                      ? proof.theory.scanningText
                      : phase === 2
                        ? '추출한 수치로 공식을 조립하고 있어요'
                        : `${activeMenuCount}개 메뉴 중 조건에 맞는 한 끼를 찾는 중`}
                  </p>
                </div>
              ) : (
                <div className="answer-revealed">
                  <div className="headline-top-row">
                    <h1 className="answer-menu-line">
                      오늘은 <span className="answer-menu-accent">{proof.menu.name}</span>
                      {josa(proof.menu.name, '이네요', '네요')}
                    </h1>
                    <button
                      type="button"
                      className="eyebrow-replay-btn"
                      onClick={handleReplay}
                      aria-label="계산 과정 다시 보기"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      <span>다시 보기</span>
                    </button>
                  </div>
                  <p className="answer-summary">{proof.theoremTitle}</p>
                </div>
              )}
            </div>

            {/* Motion-Graphic Calculation Canvas */}
            <ProofMotionStage
              proof={proof}
              phase={phase}
              runKey={runKey}
              onSkip={handleSkipMotion}
            />

            {/* Live Kinetic Formula Assembly & Candidate Elimination Cinema (Acts 1–3 only) */}
            <DeductionCinemaBar
              proof={proof}
              phase={phase}
              runKey={runKey}
              menus={menus}
              liveData={liveData}
              timing={cinemaTiming}
              soundOn={soundOn}
              onSkip={handleSkipMotion}
            />

            {/* Collapsible 3-Step Breakdown (collapsed by default on mobile to keep screen crisp & scannable) */}
            {phase === 4 && (
              <details
                key={`steps-${runKey}`}
                className="proof-disclosure"
                open={stepsOpen}
                onToggle={(e) => setStepsOpen(e.currentTarget.open)}
              >
                <summary className="proof-disclosure-summary">
                  <span className="proof-disclosure-label">계산 과정 보기</span>
                  <span className="tabular proof-disclosure-formula">
                    {proof.bridgeExpression}
                  </span>
                </summary>
                <div className="step-list" aria-label="계산 과정">
                  {proof.steps.map((step, idx) => (
                    <div
                      key={`${runKey}-${step.label}`}
                      className="step-row step-row--cascade"
                      style={{ animationDelay: `${idx * 70}ms` }}
                    >
                      <span className="step-num">{step.label}</span>
                      <div className="step-content">
                        <div className="step-equation">{step.formula}</div>
                        <p className="step-desc">{step.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Bottom Actions appear smoothly once calculation lands */}
            <div className={`result-footer-actions ${phase === 4 ? 'is-visible' : ''}`}>
              {rerollNudge && (
                <div key={`nudge-${rerollNudge.key}`} className="reroll-nudge">
                  <span>{rerollNudge.text}</span>
                  {rerollNudge.showAddHint && (
                    <button
                      type="button"
                      className="reroll-nudge-link"
                      onClick={() => setPoolOpen(true)}
                    >
                      그냥 추가하기
                    </button>
                  )}
                </div>
              )}

              <div className="result-actions">
                <button type="button" className="btn btn--primary" onClick={handleReroll}>
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>다시 찾기</span>
                </button>

                <button type="button" className="btn" onClick={handleBackHome}>
                  <span>새 문장 쓰기</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      <footer className="site-footer" aria-label="서비스 및 데이터 출처 안내">
        <p className="site-footer-line">
          입력 문장은 서버에 저장되지 않으며 브라우저에서만 처리됩니다 · 2026 바보톤 · Hosted on{' '}
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            Vercel
          </a>
        </p>
        <p className="site-footer-line">
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Weather data by Open-Meteo.com
          </a>{' '}
          (
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </a>
          ) ·{' '}
          <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">
            Rates By Exchange Rate API
          </a>
        </p>
      </footer>

      <MenuPoolDialog
        open={poolOpen}
        menus={menus}
        onClose={() => setPoolOpen(false)}
        onToggleMenu={handleToggleMenu}
        onSetMenusEnabled={handleSetMenusEnabled}
        onAddMenu={handleAddMenu}
        onResetMenus={handleResetMenus}
      />

      <CertificateDialog
        open={certOpen}
        proof={proof}
        shareUrl={shareUrl}
        onClose={() => setCertOpen(false)}
        onNotify={notify}
      />

      <div
        className={`toast ${toastMsg ? 'is-visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>
    </div>
  );
};

export default App;
