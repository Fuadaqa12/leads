// Музыка: песни Fuad по кругу 24/7.
// Если в папке public/music лежат mp3 — играем их (надёжнее, без рекламы).
// Иначе — скрытый плеер YouTube со списком шортсов.
export const YT_SONGS = ['6JsTG-NYXRE', 'da17wlItCK0', 'RIX9wLnr9FA', 'wTZ03WfjaIs'];

const muted = false;
let started = false, mode = null, audio = null, files = [], idx = 0, yt = null, ytReady = false;

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

async function loadFiles() {
  try { const r = await fetch('/music/list'); const j = await r.json(); return Array.isArray(j) ? j : []; } catch { return []; }
}

function playFile() {
  if (!files.length) return;
  audio.src = 'music/' + encodeURIComponent(files[idx % files.length]);
  audio.play().catch(() => {});
}

function loadYT() {
  return new Promise((ok) => {
    if (window.YT?.Player) return ok();
    window.onYouTubeIframeAPIReady = ok;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
}

async function startYT() {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-10px;bottom:-10px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden';
  const el = document.createElement('div'); el.id = 'ytp'; box.appendChild(el); document.body.appendChild(box);
  await loadYT();
  const list = shuffle(YT_SONGS);
  yt = new YT.Player('ytp', {
    width: 200, height: 200, videoId: list[0],
    playerVars: { autoplay: 1, playsinline: 1, controls: 0, loop: 1, playlist: list.join(','), rel: 0 },
    events: {
      onReady: (e) => { ytReady = true; e.target.setVolume(70); if (muted) e.target.mute(); e.target.playVideo(); },
      onStateChange: (e) => { if (e.data === 0) e.target.playVideo(); }, // на всякий случай: если плейлист закончился
      onError: (e) => { try { e.target.nextVideo(); } catch {} },
    },
  });
}

// вызывать из обработчика тапа: браузеры дают включить звук только после касания
export async function start() {
  if (started) { resume(); return; }
  started = true;
  files = shuffle(await loadFiles());
  if (files.length) {
    mode = 'mp3';
    audio = new Audio(); audio.volume = 0.6; audio.muted = muted;
    audio.addEventListener('ended', () => { idx++; playFile(); });
    audio.addEventListener('error', () => { idx++; setTimeout(playFile, 500); });
    playFile();
  } else {
    mode = 'yt';
    startYT().catch(() => {});
  }
}

function resume() {
  if (mode === 'mp3' && audio?.paused && !muted) audio.play().catch(() => {});
  if (mode === 'yt' && ytReady && !muted && yt.getPlayerState?.() !== 1) yt.playVideo();
}

// свернули Телеграм — пауза, вернулись — играем дальше
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { audio?.pause(); if (ytReady) yt.pauseVideo(); }
  else resume();
});
