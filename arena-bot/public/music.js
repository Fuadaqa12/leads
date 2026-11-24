// Музыка: песни Fuad по кругу 24/7, без кнопок.
// Очередь смешанная: шортсы с YouTube и mp3/mp4 из папки public/music.
// Первые песни идут в заданном порядке (FIRST), остальные — вперемешку, потом всё по кругу.
export const YT_SONGS = ['6JsTG-NYXRE', 'da17wlItCK0', 'RIX9wLnr9FA', 'wTZ03WfjaIs'];
const FIRST = ['yt:6JsTG-NYXRE', 'file:zummery.mp3'];

let started = false, queue = [], pos = -1, fails = 0, allItems = [];
let audio = null, yt = null, ytReady = null, cur = null;

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
function makeQueue() {
  const first = FIRST.filter(x => allItems.includes(x));
  return [...first, ...shuffle(allItems.filter(x => !first.includes(x)))];
}

async function loadFiles() {
  try { const r = await fetch('/music/list'); const j = await r.json(); return Array.isArray(j) ? j : []; } catch { return []; }
}

function loadYTApi() {
  return new Promise((ok, bad) => {
    if (window.YT?.Player) return ok();
    window.onYouTubeIframeAPIReady = ok;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = bad;
    document.head.appendChild(s);
  });
}

// плеер YouTube создаётся один раз, скрытым
function ytPlayer(firstId) {
  if (ytReady) return ytReady;
  ytReady = loadYTApi().then(() => new Promise((ok) => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-10px;bottom:-10px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden';
    const el = document.createElement('div'); el.id = 'ytp'; box.appendChild(el); document.body.appendChild(box);
    yt = new YT.Player('ytp', {
      width: 200, height: 200, videoId: firstId,
      playerVars: { autoplay: 1, playsinline: 1, controls: 0, rel: 0 },
      events: {
        onReady: (e) => { e.target.setVolume(70); ok(); },
        onStateChange: (e) => { if (cur?.startsWith('yt:')) { if (e.data === 0) next(); else if (e.data === 1) fails = 0; } },
        onError: () => { if (cur?.startsWith('yt:')) skip(); },
      },
    });
  }));
  return ytReady;
}

function skip() { if (++fails <= allItems.length) setTimeout(next, 800); }

async function play(item) {
  cur = item;
  if (item.startsWith('file:')) {
    if (yt?.pauseVideo) try { yt.pauseVideo(); } catch {}
    audio.src = 'music/' + encodeURIComponent(item.slice(5));
    audio.play().then(() => { fails = 0; }).catch(() => skip());
  } else {
    audio.pause();
    const id = item.slice(3);
    try {
      const fresh = !yt;
      await ytPlayer(id);
      if (cur !== item) return;
      if (!fresh) yt.loadVideoById(id); else yt.playVideo();
    } catch { skip(); } // YouTube недоступен — играем дальше файлы
  }
}

function next() {
  pos++;
  if (pos >= queue.length) { queue = makeQueue(); pos = 0; }
  play(queue[pos]);
}

// вызывать из обработчика касания: браузеры дают включить звук только после него
export async function start() {
  if (started) { resume(); return; }
  started = true;
  audio = new Audio(); audio.volume = 0.6;
  // «разблокируем» плеер mp3 прямо в момент касания, иначе айфон не даст включить его позже
  audio.muted = true; audio.src = 'music/zummery.mp3';
  audio.play().then(() => { audio.pause(); audio.muted = false; }).catch(() => { audio.muted = false; });
  audio.addEventListener('ended', () => { if (cur?.startsWith('file:')) next(); });
  audio.addEventListener('error', () => { if (cur?.startsWith('file:')) skip(); });
  const files = await loadFiles();
  allItems = [...YT_SONGS.map(id => 'yt:' + id), ...files.map(f => 'file:' + f)];
  queue = makeQueue(); pos = -1;
  next();
}

function resume() {
  if (!cur) return;
  if (cur.startsWith('file:') && audio.paused) audio.play().catch(() => {});
  if (cur.startsWith('yt:') && yt?.getPlayerState && yt.getPlayerState() !== 1) yt.playVideo();
}

// свернули Телеграм — пауза, вернулись — играем дальше
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { audio?.pause(); try { yt?.pauseVideo?.(); } catch {} }
  else resume();
});
window.__music = () => ({ cur, pos, queue, paused: audio?.paused, t: audio?.currentTime });
