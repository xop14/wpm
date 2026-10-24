const $ = id => document.getElementById(id);
const [leftEl, pivotEl, rightEl] = $('word').children;

const svg = inner => `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">${inner}</svg>`;
const ICONS = {
  play: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
};
const setPlayButton = (icon, label) => $('play').innerHTML = ICONS[icon] + label;

const strokeSvg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const SUN = strokeSvg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>');
const MOON = strokeSvg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
// Show the sun in dark mode (click for light) and the moon in light mode.
const updateThemeIcon = () => $('theme').innerHTML = isDark() ? SUN : MOON;
updateThemeIcon();
systemDark.onchange = updateThemeIcon;
$('theme').onclick = () => {
  const t = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch {}
  updateThemeIcon();
};

let words = [];   // { text, pause, end, start, stop } — pause is a multiplier on the base delay; end marks a sentence end;
                  // start/stop are character offsets in the text box
let i = 0;
let timer = null;
let wpm = 300;
let stopping = false;    // pause requested; waiting for the sentence to finish
let resumeNext = false;  // stopped on a sentence end, so resume from the next word
let playing = false;     // the text box highlight is hidden while playing
let smoothScroll = false; // jump straight to the saved word on page load, then scroll smoothly

try { wpm = +localStorage.getItem('wpm') || 300; } catch {}
try { $('sentence').checked = localStorage.getItem('sentenceStop') !== '0'; } catch {}
$('speed').value = wpm;
$('speedVal').textContent = wpm;

const sample = "Rapid serial visual presentation shows you one word at a time in a fixed spot. " +
  "The red letter is the optimal recognition point, where your eye naturally lands. " +
  "Because your eyes never have to move, you can read much faster than usual.\n\n" +
  "Paste your own text here, pick a speed, and press play.";
let saved = null;
try { saved = localStorage.getItem('text'); } catch {}
$('text').value = saved ?? sample;

// Spritz-style pivot position: roughly a third of the way in, capped.
function pivotIndex(len) {
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function parse(text) {
  const out = [];
  const paraEnd = w => { w.pause += 1.5; w.end = true; };
  for (const m of text.matchAll(/\S+/g)) {
    const t = m[0];
    const prev = out[out.length - 1];
    if (prev && /\n\s*\n/.test(text.slice(prev.stop, m.index))) paraEnd(prev);
    let pause = 1, end = false;
    if (/[.!?]["')\]]*$/.test(t)) { pause = 2.2; end = true; }
    else if (/[,;:–—]["')\]]*$/.test(t)) pause = 1.5;
    if (t.length > 8) pause += 0.3;
    out.push({ text: t, pause, end, start: m.index, stop: m.index + t.length });
  }
  if (out.length) paraEnd(out[out.length - 1]);
  return out;
}

const escapeHTML = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Mirror the textarea text in the backdrop behind it, with the current word wrapped in <mark>.
// Shown only while stopped; the backdrop is emptied otherwise.
function highlight(on) {
  const w = on && words[i], ta = $('text'), bd = $('backdrop');
  if (!w) { bd.textContent = ''; return; }
  const text = ta.value;
  bd.innerHTML = escapeHTML(text.slice(0, w.start)) + '<mark>' + escapeHTML(w.text) + '</mark>' +
    escapeHTML(text.slice(w.stop)).replace(/\n$/, '\n\n'); // keep a trailing newline's line height
  bd.scrollTop = ta.scrollTop;
  // Keep the word in view, unless the user is typing in the box.
  const m = bd.querySelector('mark');
  if (m && document.activeElement !== ta &&
      (m.offsetTop < ta.scrollTop || m.offsetTop + m.offsetHeight > ta.scrollTop + ta.clientHeight)) {
    ta.scrollTo({ top: m.offsetTop - ta.clientHeight / 3, behavior: smoothScroll ? 'smooth' : 'instant' });
  }
}

function show(w) {
  if (!w) { leftEl.textContent = pivotEl.textContent = rightEl.textContent = ''; return; }
  // Ignore leading punctuation like quotes/brackets when picking the pivot letter.
  const lead = w.text.match(/^[^\p{L}\p{N}]*/u)[0].length;
  const core = w.text.slice(lead).replace(/[^\p{L}\p{N}]+$/u, '');
  const p = lead + pivotIndex(core.length || w.text.length);
  const at = Math.min(p, w.text.length - 1);
  leftEl.textContent = w.text.slice(0, at);
  pivotEl.textContent = w.text[at];
  rightEl.textContent = w.text.slice(at + 1);
}

function render() {
  show(words[i]);
  highlight(!playing);
  const n = words.length;
  $('pos').textContent = `${Math.min(i + 1, n)} / ${n}`;
  $('bar').style.width = n ? `${(i + 1) / n * 100}%` : '0';
  const secs = Math.round((n - i - 1) * 60 / wpm);
  $('remaining').textContent = n ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left` : '';
  try { localStorage.setItem('pos', i); } catch {}
}

function tick() {
  render();
  if (stopping && words[i].end) { pause(); resumeNext = true; return; }
  const delay = 60000 / wpm * words[i].pause;
  timer = setTimeout(() => {
    if (i < words.length - 1) { i++; tick(); }
    else pause();
  }, delay);
}

function play() {
  if (!words.length) load();
  if (!words.length) return;
  if (resumeNext) i++;
  if (i >= words.length - 1) i = 0;
  setPlayButton('pause', 'Pause');
  playing = true;
  tick();
}

function pause() {
  clearTimeout(timer);
  timer = null;
  stopping = resumeNext = playing = false;
  setPlayButton('play', 'Play');
  highlight(true);
}

// Pause from the play button or Space: optionally let the current sentence finish first.
// Pressing again while finishing stops immediately.
function stop() {
  if (!$('sentence').checked || stopping) return pause();
  if (words[i].end) { pause(); resumeNext = true; return; }
  stopping = true;
  setPlayButton('pause', 'Finishing…');
}

function load() {
  pause();
  words = parse($('text').value);
  i = 0;
  render();
}

function step(d) {
  pause();
  i = Math.max(0, Math.min(words.length - 1, i + d));
  render();
}

// Jump to the start of the current sentence, or the previous one if already at a start.
function backSentence() {
  const startOf = j => { while (j > 0 && !words[j - 1].end) j--; return j; };
  let s = startOf(i);
  if (s === i) s = startOf(Math.max(0, i - 1));
  pause();
  i = s;
  render();
}

// Jump to the start of the next sentence (or the last word if there isn't one).
function forwardSentence() {
  let j = i + 1;
  while (j < words.length && !words[j - 1].end) j++;
  pause();
  i = Math.min(j, words.length - 1);
  render();
}

function setSpeed(v) {
  wpm = Math.max(100, Math.min(1000, v));
  $('speed').value = wpm;
  $('speedVal').textContent = wpm;
  try { localStorage.setItem('wpm', wpm); } catch {}
  render();
}

$('play').onclick = () => timer ? stop() : play();
$('openSettings').onclick = () => { pause(); $('settings').showModal(); };
$('closeSettings').onclick = () => $('settings').close();
$('settings').onclick = e => { if (e.target === $('settings')) $('settings').close(); }; // backdrop click
$('sentence').onchange = e => { try { localStorage.setItem('sentenceStop', e.target.checked ? '1' : '0'); } catch {} };
$('back').onclick = backSentence;
$('restart').onclick = load;
$('speed').oninput = e => setSpeed(+e.target.value);
function saveText() {
  try { localStorage.setItem('text', $('text').value); } catch {}
  load();
}
$('text').oninput = saveText;
$('text').onscroll = () => $('backdrop').scrollTop = $('text').scrollTop;
$('paste').onclick = async () => {
  try { $('text').value = await navigator.clipboard.readText(); }
  catch {
    const how = matchMedia('(pointer: coarse)').matches
      ? 'tap and hold in the text box and choose Paste'
      : 'click in the text box and press ⌘V';
    alert(`Could not read the clipboard. Instead, ${how}.`);
    return;
  }
  saveText();
};
$('clear').onclick = () => { $('text').value = ''; saveText(); $('text').focus(); };

document.addEventListener('keydown', e => {
  if (e.target === $('text') || $('settings').open) return;
  if (e.code === 'Space') { e.preventDefault(); timer ? stop() : play(); }
  else if (e.key === 'ArrowLeft') e.shiftKey ? backSentence() : step(-1);
  else if (e.key === 'ArrowRight') e.shiftKey ? forwardSentence() : step(1);
  else if (e.key === 'ArrowUp') { e.preventDefault(); setSpeed(wpm + 25); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); setSpeed(wpm - 25); }
});

// Read the saved position before load(), which resets it to 0.
let savedPos = 0;
try { savedPos = +localStorage.getItem('pos') || 0; } catch {}
load();
i = Math.min(savedPos, Math.max(words.length - 1, 0));
render();
smoothScroll = true;
