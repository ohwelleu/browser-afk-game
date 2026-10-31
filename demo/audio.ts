import { AUDIO_DEFAULTS, createAudio, SFX_NAMES, type SfxName } from '../src/audio';

const TRACKS = [
  {
    id: 'medieval',
    title: 'Medieval ambient',
    about:
      'D Dorian · 70 BPM · 16 bars (~55 s). Karplus-Strong harp, recorder with vibrato, D–A drone, soft tabor.',
  },
  {
    id: 'synthwave',
    title: 'Retro synthwave chill',
    about:
      'A minor · 90 BPM · 16 bars (~43 s). Saw pads, square arpeggio + echo, bass, soft kick/hat; snare + lead in the second half.',
  },
];

const audio = createAudio();
audio.setTrack('');

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const status = $<HTMLSpanElement>('#status');
const startButton = $<HTMLButtonElement>('#start');
const controls: HTMLButtonElement[] = [];

function button(label: string, parent: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.disabled = true;
  b.addEventListener('click', onClick);
  parent.append(b);
  controls.push(b);
  return b;
}

// --- tracks ---
let playing = '';
const playButtons = new Map<string, HTMLButtonElement>();

function selectTrack(id: string): void {
  playing = id;
  audio.setTrack(id);
  for (const [trackId, b] of playButtons) b.setAttribute('aria-pressed', String(trackId === id));
  status.textContent = id ? `playing: ${id}` : 'music stopped';
}

for (const t of TRACKS) {
  const box = document.createElement('div');
  box.className = 'track';
  box.innerHTML = `<strong>${t.title}</strong><p>${t.about}</p>`;
  playButtons.set(t.id, button('▶ Play', box, () => selectTrack(t.id)));
  button('■ Stop', box, () => playing === t.id && selectTrack(''));
  $('#tracks').append(box);
}

// --- mix ---
function slider(sel: string, initial: number, apply: (v: number) => void): void {
  const input = $<HTMLInputElement>(sel);
  const readout = input.nextElementSibling as HTMLSpanElement;
  const update = () => {
    apply(Number(input.value));
    readout.textContent = Number(input.value).toFixed(2);
  };
  input.value = String(initial);
  input.addEventListener('input', update);
  update();
}
slider('#music', AUDIO_DEFAULTS.musicVolume, (v) => audio.setMusicVolume(v));
slider('#sfx', AUDIO_DEFAULTS.sfxVolume, (v) => audio.setSfxVolume(v));
$<HTMLInputElement>('#mute').addEventListener('change', (e) =>
  audio.setMuted((e.target as HTMLInputElement).checked),
);
controls.push($('#pause'), $('#resume'));
for (const b of [$<HTMLButtonElement>('#pause'), $<HTMLButtonElement>('#resume')]) b.disabled = true;
$('#pause').addEventListener('click', () => {
  audio.pause();
  status.textContent = 'paused';
});
$('#resume').addEventListener('click', () => {
  audio.resume();
  status.textContent = playing ? `playing: ${playing}` : 'running';
});

// --- sfx ---
for (const name of SFX_NAMES) button(name, $('#sfx-buttons'), () => audio.play(name));

let combat: number | undefined;
$<HTMLInputElement>('#combat').addEventListener('change', (e) => {
  clearInterval(combat);
  if (!(e.target as HTMLInputElement).checked) return;
  let n = 0;
  combat = window.setInterval(() => {
    const beat: SfxName[] = n % 6 === 5 ? ['swing', 'mobDeath', 'coin'] : ['swing', 'hit'];
    beat.forEach((s, i) => setTimeout(() => audio.play(s), i * 90));
    n++;
  }, 900);
});

// --- start ---
startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  await audio.start();
  for (const b of controls) b.disabled = false;
  status.textContent = 'running · pick a track';
});
