// Hero demo on the landing page: a raw log that morphs into the LogStrip
// output. Every clean output and every metric in hero-scenarios.json was
// produced by running the real CLI (node dist/cli/index.js) against the raw
// log shown - nothing is hand-written. `fates` maps each raw line to its
// destiny during the morph animation: ['k', cleanIdx] survives as
// clean[cleanIdx], ['g', leaderIdx] collapses into the raw leader line,
// ['d'] is dropped. The final state is always the exact CLI output
// (cleanPre), so the morph is presentation only. Regenerate the file with
// `npm run build && node scripts/export-hero-scenarios.mjs` after parser changes.
//
// The demo plays by itself: the raw log streams in, a scan line sweeps down
// the screen and each line meets its fate as the line passes it, the tally in
// the title bar counts what was dropped, folded and kept, the metrics slide
// in, and after a short hold the next scenario starts. Any click on the
// controls hands the demo over to the visitor; hovering pauses it. With
// prefers-reduced-motion nothing plays on its own and the toggle shows the
// final state at once.
import { escapeHtml } from '../html';
import scenarios from './hero-scenarios.json';

export interface Scenario {
  id: string;
  label: string;
  title: string;
  cmd: string;
  agent: string[][];
  metrics: string[][];
  raw: string[];
  clean: string[];
  fates: (string | number)[][];
}

export interface Tally {
  dropped: number;
  folded: number;
  kept: number;
}

const SCENARIOS: Scenario[] = scenarios;

// Timings, in ms. The sweep is the time the scan line needs to cross the screen.
const SWEEP_MS = 1500;
const SWEEP_START_MS = 200;
const SETTLE_MS = 500;
const ARRIVE_STEP_MS = 14;
const ARRIVE_MAX_LINES = 40;
const FIRST_PLAY_MS = 1600;
const HOLD_MS = 5500;
const PAUSED_RETRY_MS = 600;
// Share of the demo that must be on screen before it plays.
const IN_VIEW_RATIO = 0.4;

// Anchored and unanchored patterns stay in separate expressions, so an anchor
// never applies to only one branch of an alternation.
const ERROR_PATTERN =
  /\[(?:ERROR|FATAL|CRITICAL)\]|AssertionError|npm ERR!|##\[error\]|panic|BackOff|ErrImagePull/i;
const FAIL_LINE_PATTERN = /^FAIL\s/i;
const SCANNER_PATTERN = /"Severity":\s*"(?:CRITICAL|HIGH)"|CVE-|GHSA-/;
const SEVERITY_LINE_PATTERN = /^(?:CRITICAL|HIGH)\s/;
const PLACEHOLDER_PATTERN = /\[(?:ID|HASH|IP|TIME|REDACTED|NN)\]/;

/** True for a folded value list such as `[99.99 | 49.50 | 12.00]`. Linear: no backtracking. */
function hasDeltaList(line: string): boolean {
  const pipe = line.indexOf(' | ');
  return pipe > 0 && line.lastIndexOf('[', pipe) !== -1 && line.indexOf(']', pipe) !== -1;
}

/** Wraps a clean-output line in a span that colors it by what it is. */
export function highlightLine(line: string): string {
  const esc = escapeHtml(line);
  if (line.startsWith('❯ ') || /^✓ detected:/i.test(line)) {
    return `<span class="det">${esc}</span>`;
  }
  if (/^\[x\d+\]/.test(line)) {
    return `<span class="x">${esc.replace(/^(\[x\d+\])/, '<span class="dup">$1</span>')}</span>`;
  }
  if (/\[logstrip:(?:meta|group|=)/.test(line)) return `<span class="dup">${esc}</span>`;
  if (/hidden internal (?:library|stack) frames/i.test(line)) {
    return `<span class="stk">${esc}</span>`;
  }
  if (ERROR_PATTERN.test(line) || FAIL_LINE_PATTERN.test(line)) {
    return `<span class="err">${esc}</span>`;
  }
  if (SCANNER_PATTERN.test(line) || SEVERITY_LINE_PATTERN.test(line)) {
    return `<span class="scan">${esc}</span>`;
  }
  if (line.includes('[WARN]') || /^\s*❯\s/.test(line)) return `<span class="warn">${esc}</span>`;
  if (/^\s*(?:at|✓)\s/.test(line)) return `<span class="mark">${esc}</span>`;
  if (PLACEHOLDER_PATTERN.test(line) || hasDeltaList(line)) {
    return `<span class="san">${esc}</span>`;
  }
  return esc;
}

/** Splits a metric like "80.48%" into the animated number and its surroundings. */
export function splitMetric(
  text: string
): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  if (match?.index === undefined) return null;
  return {
    prefix: text.slice(0, match.index),
    value: Number.parseFloat(match[0]),
    decimals: (match[0].split('.')[1] ?? '').length,
    suffix: text.slice(match.index + match[0].length),
  };
}

/** How many raw lines are dropped, folded into another line, or kept. */
export function tallyOf(fates: readonly (readonly (string | number)[])[]): Tally {
  const tally: Tally = { dropped: 0, folded: 0, kept: 0 };
  for (const fate of fates) {
    if (fate[0] === 'd') tally.dropped++;
    else if (fate[0] === 'g') tally.folded++;
    else tally.kept++;
  }
  return tally;
}

/** The tally as the title bar shows it while the scan line moves. */
export function formatTally(tally: Tally): string {
  return `dropped ${tally.dropped} · folded ${tally.folded} · kept ${tally.kept}`;
}

/**
 * When the scan line reaches a line that sits `top` pixels below the top of a
 * screen `height` pixels tall. Lines above the screen go first, lines below it
 * all go when the sweep ends.
 */
export function sweepDelay(top: number, height: number, duration: number): number {
  if (height <= 0) return 0;
  const share = Math.min(1, Math.max(0, top / height));
  return Math.round(share * duration);
}

/** The scenario after `current`, wrapping around to the first. */
export function nextScenario<T>(list: readonly T[], current: T): T {
  const index = list.indexOf(current);
  return list[(index + 1) % list.length];
}

interface DemoElements {
  title: HTMLElement | null;
  tally: HTMLElement | null;
  live: HTMLElement | null;
  tabs: HTMLElement[];
  progress: HTMLElement | null;
  rawBtn: HTMLElement;
  cleanBtn: HTMLElement;
  pill: HTMLElement;
  hint: HTMLElement | null;
  screen: HTMLElement;
  beam: HTMLElement | null;
  metrics: HTMLElement | null;
  rawPre: HTMLElement;
  cleanPre: HTMLElement;
  agentCard: HTMLElement | null;
}

/** The demo's controls and screens, rendered once into the hero container. */
function demoMarkup(logoUrl: string): string {
  const tabs = SCENARIOS.map(
    (s, i) =>
      `<button class="hp-demo__tab${i === 0 ? ' is-active' : ''}" type="button" role="tab" aria-selected="${i === 0}" data-logstrip-tab="${s.id}">${escapeHtml(s.label)}</button>`
  ).join('');
  return `
    <div class="hp-demo__bar">
      <span class="hp-demo__dot"></span>
      <span class="hp-demo__dot"></span>
      <span class="hp-demo__dot"></span>
      <span class="hp-demo__title" data-logstrip-title></span>
      <span class="hp-demo__tally" data-logstrip-tally></span>
      <span class="hp-sr" data-logstrip-live aria-live="polite"></span>
    </div>
    <div class="hp-demo__tabs" role="tablist" aria-label="Demo scenarios">${tabs}</div>
    <div class="hp-demo__progress" data-logstrip-progress aria-hidden="true"><i></i></div>
    <div class="hp-demo__toggle">
      <span class="hp-toggle__hint" data-logstrip-hint>plays by itself &middot; click to take over</span>
      <div class="hp-toggle__row">
        <button class="hp-toggle__side hp-toggle__side--raw is-active" data-logstrip-raw-btn type="button">raw</button>
        <button class="hp-toggle__pill" data-logstrip-pill type="button" aria-label="Switch between raw and LogStrip output">
          <span class="hp-toggle__knob"></span>
        </button>
        <button class="hp-toggle__side hp-toggle__side--clean" data-logstrip-clean-btn type="button"><img class="hp-toggle__logo" src="${logoUrl}" alt="" width="235" height="256">logstrip</button>
      </div>
    </div>
    <div class="hp-demo__screen" data-logstrip-screen>
      <pre class="hp-demo__pre hp-demo__pre--raw" data-logstrip-raw-pre tabindex="0"></pre>
      <pre class="hp-demo__pre hp-demo__pre--clean" data-logstrip-clean-pre></pre>
      <div class="hp-demo__beam" data-logstrip-beam aria-hidden="true"></div>
      <div class="hp-demo__agent" data-logstrip-agent aria-label="Agent-ready summary"></div>
    </div>
    <div class="hp-demo__metrics" data-logstrip-metrics></div>`;
}

/** Looks up the rendered elements. Null when the markup is not what we rendered. */
function findElements(root: HTMLElement): DemoElements | null {
  const one = <T extends HTMLElement>(selector: string): T | null => root.querySelector<T>(selector);
  const rawBtn = one('[data-logstrip-raw-btn]');
  const cleanBtn = one('[data-logstrip-clean-btn]');
  const pill = one('[data-logstrip-pill]');
  const screen = one('[data-logstrip-screen]');
  const rawPre = one('[data-logstrip-raw-pre]');
  const cleanPre = one('[data-logstrip-clean-pre]');
  if (!rawBtn || !cleanBtn || !pill || !screen || !rawPre || !cleanPre) return null;
  return {
    title: one('[data-logstrip-title]'),
    tally: one('[data-logstrip-tally]'),
    live: one('[data-logstrip-live]'),
    tabs: Array.from(root.querySelectorAll<HTMLElement>('[data-logstrip-tab]')),
    progress: one('[data-logstrip-progress]'),
    rawBtn,
    cleanBtn,
    pill,
    hint: one('[data-logstrip-hint]'),
    screen,
    beam: one('[data-logstrip-beam]'),
    metrics: one('[data-logstrip-metrics]'),
    rawPre,
    cleanPre,
    agentCard: one('[data-logstrip-agent]'),
  };
}

/** Wires one hero demo: scenarios, the raw/clean toggle and the autoplay loop. */
function setupCompareDemo(root: HTMLElement, logoUrl: string): void {
  if (root.dataset.logstripCompareReady === 'true') return;
  root.dataset.logstripCompareReady = 'true';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML = demoMarkup(logoUrl);
  const els = findElements(root);
  if (!els) return;

  let mode: 'raw' | 'clean' | 'morphing' = 'raw';
  let current = SCENARIOS[0];
  let morphTimers: ReturnType<typeof setTimeout>[] = [];

  // Autoplay state. It stops for good at the first click on a control.
  // Pointer and focus are tracked apart, so the demo stays paused while
  // either one is still inside it.
  let autoplay = !prefersReduced;
  let pointerIn = false;
  let focusIn = false;
  let inView = true;
  let autoTimer: ReturnType<typeof setTimeout> | undefined;

  const clearMorph = (): void => {
    morphTimers.forEach(clearTimeout);
    morphTimers = [];
  };

  const schedule = (fn: () => void, ms: number): void => {
    morphTimers.push(setTimeout(fn, ms));
  };

  const renderRaw = (scenario: Scenario, arrive: boolean): void => {
    els.rawPre.innerHTML = scenario.raw
      .map((line, i) => {
        const cls = arrive ? ' is-arriving' : '';
        const delay = arrive ? ` style="--i:${Math.min(i, ARRIVE_MAX_LINES)}"` : '';
        return `<span class="hp-demo__ln${cls}"${delay}>${escapeHtml(line) || ' '}</span>`;
      })
      .join('');
    els.rawPre.scrollTop = 0;
  };

  // The visible tally changes with every line. Screen readers only hear the
  // final one, through the live region.
  const setTally = (text: string, announce = false): void => {
    if (els.tally) els.tally.textContent = text;
    if (announce && els.live) els.live.textContent = text;
  };

  const setControls = (clean: boolean): void => {
    els.rawBtn.classList.toggle('is-active', !clean);
    els.cleanBtn.classList.toggle('is-active', clean);
    els.pill.classList.toggle('is-clean', clean);
    els.hint?.classList.toggle('is-hidden', clean || !autoplay);
  };

  const setProgress = (running: boolean): void => {
    if (!els.progress) return;
    els.progress.style.setProperty('--hp-hold', `${HOLD_MS}ms`);
    els.progress.classList.toggle('is-running', running);
  };

  const animateMetric = (el: HTMLElement): void => {
    const finalText = el.dataset.logstripFinal ?? '';
    const parts = splitMetric(finalText);
    if (!parts || prefersReduced) {
      el.textContent = finalText;
      return;
    }
    const startTime = performance.now();
    const duration = 900;
    const frame = (now: number): void => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = parts.prefix + (parts.value * eased).toFixed(parts.decimals) + parts.suffix;
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    };
    requestAnimationFrame(frame);
  };

  const canPlay = (): boolean =>
    autoplay && inView && !pointerIn && !focusIn && !document.hidden;

  const arm = (fn: () => void, ms: number): void => {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(fn, ms);
  };

  const finishClean = (): void => {
    mode = 'clean';
    els.screen.dataset.logstripMode = 'clean';
    els.beam?.classList.remove('is-sweeping');
    els.metrics?.classList.add('is-visible');
    els.metrics?.querySelectorAll<HTMLElement>('strong').forEach(animateMetric);
    setTally(`${current.raw.length} → ${current.clean.length} lines`, true);
    if (autoplay) {
      setProgress(true);
      arm(autoAdvance, HOLD_MS);
    }
  };

  const startMorph = (): void => {
    mode = 'morphing';
    setControls(true);
    els.metrics?.classList.remove('is-visible');
    setProgress(false);
    const spans = els.rawPre.children;
    const height = els.screen.clientHeight;
    const scrollTop = els.rawPre.scrollTop;
    const seen: Tally = { dropped: 0, folded: 0, kept: 0 };
    setTally(formatTally(seen));
    els.beam?.classList.add('is-sweeping');
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i] as HTMLElement;
      // The arrival animation would otherwise pin opacity and block the fade.
      span.classList.remove('is-arriving');
      const fate = current.fates[i] ?? ['d'];
      const at = SWEEP_START_MS + sweepDelay(span.offsetTop - scrollTop, height, SWEEP_MS);
      schedule(() => {
        if (fate[0] === 'd') {
          span.classList.add('is-dropping');
          seen.dropped++;
        } else if (fate[0] === 'g') {
          span.classList.add('is-merging');
          seen.folded++;
        } else {
          span.innerHTML = highlightLine(current.clean[fate[1] as number]);
          span.classList.add('is-swapped');
          seen.kept++;
        }
        setTally(formatTally(seen));
      }, at);
    }
    schedule(finishClean, SWEEP_START_MS + SWEEP_MS + SETTLE_MS);
  };

  const setMode = (next: 'raw' | 'clean', arrive = false): void => {
    if (next === 'clean') {
      if (mode !== 'raw') return;
      if (prefersReduced) {
        setControls(true);
        finishClean();
      } else {
        startMorph();
      }
      return;
    }
    clearMorph();
    mode = 'raw';
    renderRaw(current, arrive);
    els.screen.dataset.logstripMode = 'raw';
    els.beam?.classList.remove('is-sweeping');
    setControls(false);
    setProgress(false);
    els.metrics?.classList.remove('is-visible');
    setTally(`${current.raw.length} lines`);
  };

  const setScenario = (scenario: Scenario, arrive = false): void => {
    clearMorph();
    current = scenario;
    if (els.title) els.title.textContent = scenario.title;
    els.cleanPre.innerHTML = scenario.clean.map(highlightLine).join('\n');
    if (els.agentCard) {
      els.agentCard.innerHTML =
        '<span class="hp-demo__agent-kicker">what the agent sees</span>' +
        scenario.agent
          .map(
            ([label, value]) =>
              `<div class="hp-demo__agent-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`
          )
          .join('');
    }
    if (els.metrics) {
      els.metrics.innerHTML = scenario.metrics
        .map(
          ([value, label]) =>
            `<span><strong data-logstrip-final="${escapeHtml(value)}">${escapeHtml(value)}</strong> ${escapeHtml(label)}</span>`
        )
        .join('');
    }
    els.tabs.forEach((tab) => {
      const active = tab.dataset.logstripTab === scenario.id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    mode = 'morphing'; // force setMode('raw') to do a full reset
    setMode('raw', arrive);
  };

  // Autoplay: morph when the raw log has arrived, move on after the hold.
  const autoMorph = (): void => {
    if (!canPlay()) {
      arm(autoMorph, PAUSED_RETRY_MS);
      return;
    }
    if (mode === 'raw') setMode('clean');
  };

  function autoAdvance(): void {
    if (!canPlay()) {
      arm(autoAdvance, PAUSED_RETRY_MS);
      return;
    }
    setScenario(nextScenario(SCENARIOS, current), true);
    const arrival = Math.min(current.raw.length, ARRIVE_MAX_LINES) * ARRIVE_STEP_MS;
    arm(autoMorph, arrival + 900);
  }

  // The visitor takes the wheel: autoplay ends and never comes back.
  const takeOver = (): void => {
    if (!autoplay) return;
    autoplay = false;
    clearTimeout(autoTimer);
    setProgress(false);
    els.hint?.classList.add('is-hidden');
  };

  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      takeOver();
      const scenario = SCENARIOS.find((s) => s.id === tab.dataset.logstripTab);
      if (scenario) setScenario(scenario);
    });
  });

  els.rawBtn.addEventListener('click', () => {
    takeOver();
    setMode('raw');
  });
  els.cleanBtn.addEventListener('click', () => {
    takeOver();
    setMode('clean');
  });
  els.pill.addEventListener('click', () => {
    takeOver();
    setMode(mode === 'raw' ? 'clean' : 'raw');
  });

  setScenario(SCENARIOS[0], autoplay);
  if (!autoplay) return;

  // Hovering or focusing the demo pauses it, so a reader can study a frame.
  root.addEventListener('mouseenter', () => {
    pointerIn = true;
  });
  root.addEventListener('mouseleave', () => {
    pointerIn = false;
  });
  root.addEventListener('focusin', () => {
    focusIn = true;
  });
  root.addEventListener('focusout', () => {
    focusIn = false;
  });
  // isIntersecting is also true below the threshold, so the ratio decides.
  if ('IntersectionObserver' in window) {
    inView = false;
    new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.intersectionRatio >= IN_VIEW_RATIO);
      },
      { threshold: IN_VIEW_RATIO }
    ).observe(root);
  }
  arm(autoMorph, FIRST_PLAY_MS);
}

/** Starts every `[data-logstrip-compare]` demo on the page. */
export function initHeroDemo(baseUrl: string): void {
  const logoUrl = `${baseUrl.replace(/\/$/, '')}/assets/images/logo2-256.webp`;
  document
    .querySelectorAll<HTMLElement>('[data-logstrip-compare]')
    .forEach((root) => setupCompareDemo(root, logoUrl));
}
