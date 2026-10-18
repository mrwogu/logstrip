// Hero demo on the landing page: a raw log that morphs into the LogStrip
// output. Every clean output and every metric in hero-scenarios.json was
// produced by running the real CLI (node dist/cli/index.js) against the raw
// log shown - nothing is hand-written. `fates` maps each raw line to its
// destiny during the morph animation: ['k', cleanIdx] survives as
// clean[cleanIdx], ['g', leaderIdx] collapses into the raw leader line,
// ['d'] is dropped. The final state is always the exact CLI output
// (cleanPre), so the morph is presentation only. Regenerate with the
// commands recorded in each scenario's `cmd` field if parser output changes.
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

/** Wraps a clean-output line in a span that colors it by what it is. */
export function highlightLine(line: string): string {
  const esc = escapeHtml(line);
  if (/^❯ /.test(line)) return `<span class="det">${esc}</span>`;
  if (/^✓ detected:/i.test(line)) return `<span class="det">${esc}</span>`;
  if (/^\[x\d+\]/.test(line)) {
    return `<span class="x">${esc.replace(/^(\[x\d+\])/, '<span class="dup">$1</span>')}</span>`;
  }
  if (/\[logstrip:(?:meta|group|=)/.test(line)) return `<span class="dup">${esc}</span>`;
  if (/hidden internal (?:library|stack) frames/i.test(line)) {
    return `<span class="stk">${esc}</span>`;
  }
  if (
    /\[(?:ERROR|FATAL|CRITICAL)\]|^FAIL\s|AssertionError|npm ERR!|##\[error\]|panic|BackOff|ErrImagePull/i.test(
      line
    )
  ) {
    return `<span class="err">${esc}</span>`;
  }
  if (/"Severity":\s*"(?:CRITICAL|HIGH)"|CVE-|GHSA-|^CRITICAL\s|^HIGH\s/.test(line)) {
    return `<span class="scan">${esc}</span>`;
  }
  if (/\[(?:WARN)\]|^\s*❯\s/i.test(line)) return `<span class="warn">${esc}</span>`;
  if (/^\s*at\s|^\s*✓\s/.test(line)) return `<span class="mark">${esc}</span>`;
  if (/\[ID\]|\[HASH\]|\[IP\]|\[TIME\]|\[REDACTED\]|\[NN\]|\[[^\]]+\s\|\s[^\]]+\]/.test(line)) {
    return `<span class="san">${esc}</span>`;
  }
  return esc;
}

/** Splits a metric like "80.48%" into the animated number and its surroundings. */
export function splitMetric(
  text: string
): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match || match.index === undefined) return null;
  return {
    prefix: text.slice(0, match.index),
    value: parseFloat(match[0]),
    decimals: (match[0].split('.')[1] ?? '').length,
    suffix: text.slice(match.index + match[0].length),
  };
}

function query<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function setupCompareDemo(root: HTMLElement, logoUrl: string): void {
  if (root.dataset.logstripCompareReady === 'true') return;
  root.dataset.logstripCompareReady = 'true';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.innerHTML = `
    <div class="logstrip-demo__bar">
      <span class="logstrip-demo__dot"></span>
      <span class="logstrip-demo__dot"></span>
      <span class="logstrip-demo__dot"></span>
      <span class="logstrip-demo__title" data-logstrip-title></span>
    </div>
    <div class="logstrip-demo__tabs" role="tablist" aria-label="Demo scenarios">
      ${SCENARIOS.map((s, i) => `<button class="logstrip-demo__tab${i === 0 ? ' is-active' : ''}" type="button" role="tab" aria-selected="${i === 0}" data-logstrip-tab="${s.id}">${escapeHtml(s.label)}</button>`).join('')}
    </div>
    <div class="logstrip-demo__toggle" data-logstrip-toggle>
      <span class="logstrip-toggle__hint" data-logstrip-hint>try me <span class="logstrip-toggle__arrow">↓</span></span>
      <div class="logstrip-toggle__row">
        <button class="logstrip-toggle__side logstrip-toggle__side--raw is-active" data-logstrip-raw-btn type="button">raw</button>
        <button class="logstrip-toggle__pill" data-logstrip-pill type="button" aria-label="Switch between raw and LogStrip output">
          <span class="logstrip-toggle__knob"></span>
        </button>
        <button class="logstrip-toggle__side logstrip-toggle__side--clean" data-logstrip-clean-btn type="button"><img class="logstrip-toggle__icon logstrip-toggle__icon--logo" src="${logoUrl}" alt="" width="235" height="256">logstrip</button>
      </div>
    </div>
    <div class="logstrip-demo__screen" data-logstrip-screen>
      <pre class="logstrip-demo__pre logstrip-demo__pre--raw" data-logstrip-raw-pre></pre>
      <pre class="logstrip-demo__pre logstrip-demo__pre--clean" data-logstrip-clean-pre></pre>
      <div class="logstrip-demo__agent-card" data-logstrip-agent aria-label="Agent-ready summary"></div>
    </div>
    <div class="logstrip-demo__metrics" data-logstrip-metrics></div>`;

  const title = query<HTMLElement>(root, '[data-logstrip-title]');
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[data-logstrip-tab]'));
  const rawBtn = query<HTMLElement>(root, '[data-logstrip-raw-btn]');
  const cleanBtn = query<HTMLElement>(root, '[data-logstrip-clean-btn]');
  const pill = query<HTMLElement>(root, '[data-logstrip-pill]');
  const hint = query<HTMLElement>(root, '[data-logstrip-hint]');
  const screen = query<HTMLElement>(root, '[data-logstrip-screen]');
  const metrics = query<HTMLElement>(root, '[data-logstrip-metrics]');
  const rawPre = query<HTMLElement>(root, '[data-logstrip-raw-pre]');
  const cleanPre = query<HTMLElement>(root, '[data-logstrip-clean-pre]');
  const agentCard = query<HTMLElement>(root, '[data-logstrip-agent]');

  if (!rawBtn || !cleanBtn || !pill || !screen || !rawPre || !cleanPre) return;

  let mode: 'raw' | 'clean' | 'morphing' = 'raw';
  let current = SCENARIOS[0];
  let morphTimers: ReturnType<typeof setTimeout>[] = [];

  function clearMorph(): void {
    morphTimers.forEach(clearTimeout);
    morphTimers = [];
  }

  function schedule(fn: () => void, ms: number): void {
    morphTimers.push(setTimeout(fn, ms));
  }

  function renderRaw(scenario: Scenario): void {
    rawPre!.innerHTML = scenario.raw
      .map((line) => `<span class="logstrip-demo__ln">${escapeHtml(line) || ' '}</span>`)
      .join('');
  }

  function setControls(clean: boolean): void {
    rawBtn!.classList.toggle('is-active', !clean);
    cleanBtn!.classList.toggle('is-active', clean);
    pill!.classList.toggle('is-clean', clean);
    hint?.classList.toggle('is-hidden', clean);
  }

  function animateMetric(el: HTMLElement): void {
    const finalText = el.dataset.logstripFinal ?? '';
    const parts = splitMetric(finalText);
    if (!parts || prefersReduced) {
      el.textContent = finalText;
      return;
    }
    const startTime = performance.now();
    const duration = 900;
    function frame(now: number): void {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent =
        parts!.prefix + (parts!.value * eased).toFixed(parts!.decimals) + parts!.suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }

  function finishClean(): void {
    mode = 'clean';
    screen!.dataset.logstripMode = 'clean';
    metrics?.classList.add('is-visible');
    metrics?.querySelectorAll<HTMLElement>('strong').forEach(animateMetric);
  }

  function startMorph(): void {
    mode = 'morphing';
    setControls(true);
    metrics?.classList.remove('is-visible');
    const spans = rawPre!.children;
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
  }

  function setMode(next: 'raw' | 'clean'): void {
    if (next === 'clean') {
      if (mode !== 'raw') return;
      if (prefersReduced) {
        setControls(true);
        finishClean();
      } else {
        startMorph();
      }
    } else {
      clearMorph();
      mode = 'raw';
      renderRaw(current);
      screen!.dataset.logstripMode = 'raw';
      setControls(false);
      metrics?.classList.remove('is-visible');
    }
  }

  function setScenario(scenario: Scenario): void {
    clearMorph();
    current = scenario;
    if (title) title.textContent = scenario.title;
    cleanPre!.innerHTML = scenario.clean.map(highlightLine).join('\n');
    if (agentCard) {
      agentCard.innerHTML =
        '<span class="logstrip-demo__agent-kicker">what the agent sees</span>' +
        scenario.agent
          .map(
            ([label, value]) =>
              `<div class="logstrip-demo__agent-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`
          )
          .join('');
    }
    if (metrics) {
      metrics.innerHTML = scenario.metrics
        .map(
          ([value, label]) =>
            `<span><strong data-logstrip-final="${escapeHtml(value)}">${escapeHtml(value)}</strong> ${escapeHtml(label)}</span>`
        )
        .join('');
    }
    tabs.forEach((tab) => {
      const active = tab.dataset.logstripTab === scenario.id;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    mode = 'morphing'; // force setMode('raw') to do a full reset
    setMode('raw');
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const scenario = SCENARIOS.find((s) => s.id === tab.dataset.logstripTab);
      if (scenario) setScenario(scenario);
    });
  });

  rawBtn.addEventListener('click', () => setMode('raw'));
  cleanBtn.addEventListener('click', () => setMode('clean'));
  pill.addEventListener('click', () => setMode(mode === 'raw' ? 'clean' : 'raw'));

  setScenario(SCENARIOS[0]);

  // Pulse the switch a few times to invite a click
  let pulseCount = 0;
  const pulseInterval = setInterval(() => {
    pulseCount++;
    if (pulseCount > 6 || mode !== 'raw') {
      clearInterval(pulseInterval);
      return;
    }
    pill.classList.add('is-pulsing');
    setTimeout(() => pill.classList.remove('is-pulsing'), 600);
  }, 2400);
}

/** Starts every `[data-logstrip-compare]` demo on the page. */
export function initHeroDemo(baseUrl: string): void {
  const logoUrl = `${baseUrl.replace(/\/$/, '')}/assets/images/logo2-256.webp`;
  document
    .querySelectorAll<HTMLElement>('[data-logstrip-compare]')
    .forEach((root) => setupCompareDemo(root, logoUrl));
}
