// Hero demo on the landing page: a raw log that morphs into the LogStrip
// output. Every clean output and every metric in hero-scenarios.json was
// produced by running the real CLI (node dist/cli/index.js) against the raw
// log shown - nothing is hand-written. `fates` maps each raw line to its
// destiny during the morph animation: ['k', cleanIdx] survives as
// clean[cleanIdx], ['g', leaderIdx] collapses into the raw leader line,
// ['d'] is dropped. The final state is always the exact CLI output
// (cleanPre), so the morph is presentation only. Regenerate the file with
// `npm run build && node scripts/export-hero-scenarios.mjs` after parser changes.
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

const SCENARIOS: Scenario[] = scenarios;

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

interface DemoElements {
  title: HTMLElement | null;
  tabs: HTMLElement[];
  rawBtn: HTMLElement;
  cleanBtn: HTMLElement;
  pill: HTMLElement;
  hint: HTMLElement | null;
  screen: HTMLElement;
  metrics: HTMLElement | null;
  rawPre: HTMLElement;
  cleanPre: HTMLElement;
  agentCard: HTMLElement | null;
}

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
    </div>
    <div class="hp-demo__tabs" role="tablist" aria-label="Demo scenarios">${tabs}</div>
    <div class="hp-demo__toggle">
      <span class="hp-toggle__hint" data-logstrip-hint>try me &darr;</span>
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
      <div class="hp-demo__agent" data-logstrip-agent aria-label="Agent-ready summary"></div>
    </div>
    <div class="hp-demo__metrics" data-logstrip-metrics></div>`;
}

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
    tabs: Array.from(root.querySelectorAll<HTMLElement>('[data-logstrip-tab]')),
    rawBtn,
    cleanBtn,
    pill,
    hint: one('[data-logstrip-hint]'),
    screen,
    metrics: one('[data-logstrip-metrics]'),
    rawPre,
    cleanPre,
    agentCard: one('[data-logstrip-agent]'),
  };
}

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

  const clearMorph = (): void => {
    morphTimers.forEach(clearTimeout);
    morphTimers = [];
  };

  const schedule = (fn: () => void, ms: number): void => {
    morphTimers.push(setTimeout(fn, ms));
  };

  const renderRaw = (scenario: Scenario): void => {
    els.rawPre.innerHTML = scenario.raw
      .map((line) => `<span class="hp-demo__ln">${escapeHtml(line) || ' '}</span>`)
      .join('');
  };

  const setControls = (clean: boolean): void => {
    els.rawBtn.classList.toggle('is-active', !clean);
    els.cleanBtn.classList.toggle('is-active', clean);
    els.pill.classList.toggle('is-clean', clean);
    els.hint?.classList.toggle('is-hidden', clean);
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

  const finishClean = (): void => {
    mode = 'clean';
    els.screen.dataset.logstripMode = 'clean';
    els.metrics?.classList.add('is-visible');
    els.metrics?.querySelectorAll<HTMLElement>('strong').forEach(animateMetric);
  };

  const startMorph = (): void => {
    mode = 'morphing';
    setControls(true);
    els.metrics?.classList.remove('is-visible');
    const spans = els.rawPre.children;
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i] as HTMLElement;
      const fate = current.fates[i] ?? ['d'];
      if (fate[0] === 'd') {
        schedule(() => span.classList.add('is-dropping'), 120 + (i % 40) * 16);
      } else if (fate[0] === 'g') {
        schedule(() => span.classList.add('is-merging'), 360 + (i % 40) * 16);
      } else {
        schedule(
          () => {
            span.innerHTML = highlightLine(current.clean[fate[1] as number]);
            span.classList.add('is-swapped');
          },
          650 + (i % 40) * 22
        );
      }
    }
    schedule(finishClean, 1800);
  };

  const setMode = (next: 'raw' | 'clean'): void => {
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
    renderRaw(current);
    els.screen.dataset.logstripMode = 'raw';
    setControls(false);
    els.metrics?.classList.remove('is-visible');
  };

  const setScenario = (scenario: Scenario): void => {
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
    setMode('raw');
  };

  els.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const scenario = SCENARIOS.find((s) => s.id === tab.dataset.logstripTab);
      if (scenario) setScenario(scenario);
    });
  });

  els.rawBtn.addEventListener('click', () => setMode('raw'));
  els.cleanBtn.addEventListener('click', () => setMode('clean'));
  els.pill.addEventListener('click', () => setMode(mode === 'raw' ? 'clean' : 'raw'));

  setScenario(SCENARIOS[0]);
  if (prefersReduced) return;

  // Pulse the switch a few times to invite a click, then stop.
  let pulseCount = 0;
  const pulseInterval = setInterval(() => {
    pulseCount++;
    if (pulseCount > 4 || mode !== 'raw') {
      clearInterval(pulseInterval);
      return;
    }
    els.pill.classList.add('is-pulsing');
    setTimeout(() => els.pill.classList.remove('is-pulsing'), 600);
  }, 2400);
}

/** Starts every `[data-logstrip-compare]` demo on the page. */
export function initHeroDemo(baseUrl: string): void {
  const logoUrl = `${baseUrl.replace(/\/$/, '')}/assets/images/logo2-256.webp`;
  document
    .querySelectorAll<HTMLElement>('[data-logstrip-compare]')
    .forEach((root) => setupCompareDemo(root, logoUrl));
}
