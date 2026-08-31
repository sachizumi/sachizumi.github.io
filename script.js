const tiles = Array.from(document.querySelectorAll('.art-tile'));
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxThumbs = document.getElementById('lightboxThumbs');
let lastFocused = null;
let currentIndex = 0;

function renderThumbs(){
  lightboxThumbs.innerHTML = '';
  if (tiles.length <= 1) return;
  tiles.forEach((tile, i) => {
    const { type, alt } = tile.dataset;
    const thumbImg = tile.querySelector('img');
    const btn = document.createElement('button');
    btn.className = 'lightbox-thumb' + (type === 'video' ? ' is-video' : '');
    btn.setAttribute('aria-label', (alt || `Item ${i + 1}`));
    const img = document.createElement('img');
    img.src = thumbImg.src;
    img.alt = '';
    btn.appendChild(img);
    btn.addEventListener('click', () => showIndex(i));
    lightboxThumbs.appendChild(btn);
  });
  updateActiveThumb();
}

function updateActiveThumb(){
  lightboxThumbs.querySelectorAll('.lightbox-thumb').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
  });
}

function loadContent(){
  const tile = tiles[currentIndex];
  const { type, full, alt } = tile.dataset;
  lightboxContent.innerHTML = '';
  if (type === 'video'){
    const video = document.createElement('video');
    video.src = full;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    lightboxContent.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = full;
    img.alt = alt || '';
    lightboxContent.appendChild(img);
  }
}

function showIndex(i){
  currentIndex = (i + tiles.length) % tiles.length;
  loadContent();
  updateActiveThumb();
  Sound.click();
}

function openLightbox(index){
  currentIndex = index;
  Sound.open();
  loadContent();
  renderThumbs();
  const multi = tiles.length > 1;
  lightboxPrev.style.display = multi ? '' : 'none';
  lightboxNext.style.display = multi ? '' : 'none';
  lastFocused = document.activeElement;
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function closeLightbox(){
  Sound.close();
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxContent.innerHTML = ''; // stops video playback
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

tiles.forEach((tile, i) => tile.addEventListener('click', () => openLightbox(i)));
lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => showIndex(currentIndex - 1));
lightboxNext.addEventListener('click', () => showIndex(currentIndex + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') showIndex(currentIndex - 1);
  if (e.key === 'ArrowRight') showIndex(currentIndex + 1);
});

/* ---------- sound engine (synthesized, no audio files) ---------- */
const Sound = (function(){
  let ctx = null;
  let master = null;
  let enabled = localStorage.getItem('elle-sound') !== 'off';

  function ensureCtx(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', peak = 1, glideTo = null){
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.linearRampToValueAtTime(glideTo, start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function play(fn){
    if (!enabled) return;
    ensureCtx();
    try { fn(ctx.currentTime); } catch (e) { /* audio unavailable, fail silently */ }
  }

  return {
    hover: () => play(t => tone(760, t, 0.05, 'sine', 0.5)),
    click: () => play(t => tone(520, t, 0.07, 'sine', 0.7, 660)),
    type:  () => play(t => tone(680 + Math.random() * 160, t, 0.025, 'sine', 0.35)),
    open:  () => play(t => { tone(480, t, 0.09, 'sine', 0.6, 720); }),
    close: () => play(t => { tone(600, t, 0.08, 'sine', 0.55, 380); }),
    copy:  () => play(t => { tone(700, t, 0.05, 'sine', 0.55); tone(920, t + 0.06, 0.06, 'sine', 0.55); }),
    confirm: () => play(t => { tone(500, t, 0.05, 'sine', 0.5); tone(760, t + 0.05, 0.07, 'sine', 0.55); }),
    isEnabled: () => enabled,
    setEnabled(v){
      enabled = v;
      localStorage.setItem('elle-sound', v ? 'on' : 'off');
    }
  };
})();

(function(){
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(Sound.isEnabled()));
  btn.addEventListener('click', () => {
    const next = !Sound.isEnabled();
    Sound.setEnabled(next);
    btn.setAttribute('aria-pressed', String(next));
    if (next) Sound.confirm();
  });
})();

document.querySelectorAll('a, button').forEach(el => {
  if (el.id === 'soundToggle') return;
  el.addEventListener('mouseenter', () => Sound.hover());
  if (!el.classList.contains('art-tile') && !el.classList.contains('copy-btn') && !el.classList.contains('lightbox-nav')){
    el.addEventListener('click', () => Sound.click());
  }
});

/* ---------- copy buttons ---------- */
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const original = btn.textContent;
    btn.textContent = '[ copied! ]';
    btn.classList.add('copied');
    Sound.copy();
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1400);
  });
});

/* ---------- status ticker ---------- */
(function(){
  const ticker = document.getElementById('ticker');
  const track = document.getElementById('tickerTrack');
  if (!track || !ticker) return;

  // Capture the real items once, before we start filling the track with repeats.
  const baseItems = Array.from(track.children)
    .filter(el => !el.hasAttribute('aria-hidden'))
    .map(el => el.cloneNode(true));

  const GAP_CONSTANT = 220;
  const gap = Math.min(150, Math.max(40, GAP_CONSTANT / baseItems.length));
  track.style.setProperty('--ticker-gap', `${gap}px`);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PIXELS_PER_SECOND = 36;

  function build(){
    track.innerHTML = '';

    // Repeat the item cycle until it's at least as wide as the ticker bar
    // itself otherwise, on wide screens, the short content runs out and
    // leaves a blank stretch before the loop restarts.
    let guard = 0;
    while (track.scrollWidth < ticker.clientWidth && guard < 40){
      baseItems.forEach(item => track.appendChild(item.cloneNode(true)));
      guard++;
    }

    const halfWidth = track.scrollWidth;

    // Duplicate that whole filled half once more (aria-hidden) so the
    // marquee has two identical halves and can loop seamlessly.
    Array.from(track.children).forEach(item => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    if (!reduceMotion){
      // Keep scroll speed constant, so more content just takes proportionally
      // longer to loop instead of feeling rushed or slow.
      const duration = Math.max(halfWidth / PIXELS_PER_SECOND, 6);
      track.style.animationDuration = `${duration}s`;
    }
  }

  build();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });
})();

/* ---------- talking sprite buddy ---------- */
(function(){
  const buddy = document.getElementById('buddy');
  const bubble = document.getElementById('buddyBubble');
  const textEl = document.getElementById('buddyText');
  const moreEl = document.getElementById('buddyMore');
  const img = document.getElementById('buddyImg');
  if (!buddy) return;

  const IDLE_SRC = 'assets/sprite/idle.png';
  const TALK_SRC = 'assets/sprite/talk.png';
  const SHOCK_SRC = 'assets/sprite/shock.png';

  const lines = [
    "oh! a visitor! o-o",
    "she/they, if that wasn't already clear from the bow",
    "still procrastinating on literally everything lol",
    "I didn't like page builders and I have more customizability here so...",
    "psst! the art section has some stuff I actually finished for once",
    "thanks for stopping by!",
    "...okay you can stop clicking me now. or don't, I'm not the boss of you"
  ];
  const idleLines = ["...", "la la la la \ud83c\udfb5"];
  let index = 0;
  let idleIndex = 0;
  let typing = false;
  let typeTimer = null;
  let flapTimer = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typeLine(line, useShock){
    typing = true;
    moreEl.style.opacity = '0';
    textEl.textContent = '';
    bubble.classList.add('show');
    clearInterval(typeTimer);
    clearInterval(flapTimer);

    if (reduceMotion){
      textEl.textContent = line;
      img.src = useShock ? SHOCK_SRC : IDLE_SRC;
      typing = false;
      moreEl.style.opacity = '1';
      return;
    }

    if (useShock){
      img.src = SHOCK_SRC; // startled, static. no mouth flap for this one
    } else {
      img.src = TALK_SRC;
      flapTimer = setInterval(() => {
        img.src = img.src.endsWith('talk.png') ? IDLE_SRC : TALK_SRC;
      }, 130);
    }

    let i = 0;
    typeTimer = setInterval(() => {
      i++;
      textEl.textContent = line.slice(0, i);
      const lastChar = line[i - 1];
      if (lastChar && lastChar.trim() !== '') Sound.type();
      if (i >= line.length){
        clearInterval(typeTimer);
        clearInterval(flapTimer);
        img.src = IDLE_SRC;
        typing = false;
        moreEl.style.opacity = '1';
      }
    }, 32);
  }

  function nextLine(){
    if (typing) return;
    let line, useShock;
    if (index < lines.length){
      line = lines[index];
      useShock = (index === 0);
      index++;
    } else {
      line = idleLines[idleIndex % idleLines.length];
      useShock = false;
      idleIndex++;
    }
    typeLine(line, useShock);
  }

  buddy.addEventListener('click', nextLine);

  window.addEventListener('load', () => {
    setTimeout(() => {
      buddy.classList.add('revealed');
      img.src = SHOCK_SRC; // startled the moment she pops into view
      setTimeout(() => {
        nextLine();
      }, reduceMotion ? 50 : 1500);
    }, 700);
  });
})();

/* ---------- ID3 tag reader ---------- */
/* Pulls title, artist, and embedded cover art straight out of an MP3's
   ID3v2 tag (the same data your OS or Spotify reads), so the player
   below doesn't need a hand-maintained title/artist/cover per track
   just point it at the file. Covers ID3v2.3 and v2.4 tags, which is
   what virtually every modern tagger (iTunes, Mp3tag, ffmpeg, etc.)
   writes. Known gaps: no support for the old 3-char-frame-ID v2.2
   format, and unsynchronized frames aren't decoded both are rare
   in practice. */
const ID3 = (function(){
  function syncsafeToInt(b){
    return ((b[0] & 0x7f) << 21) | ((b[1] & 0x7f) << 14) | ((b[2] & 0x7f) << 7) | (b[3] & 0x7f);
  }
  function bigEndianToInt(b){
    return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
  }
  function decodeText(bytes, encoding){
    if (encoding === 1 || encoding === 2){
      let littleEndian = encoding === 1;
      let start = 0;
      if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE){ start = 2; littleEndian = true; }
      else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF){ start = 2; littleEndian = false; }
      let str = '';
      for (let i = start; i + 1 < bytes.length; i += 2){
        const code = littleEndian ? (bytes[i] | (bytes[i + 1] << 8)) : ((bytes[i] << 8) | bytes[i + 1]);
        str += String.fromCharCode(code);
      }
      return str.replace(/\u0000+$/, '');
    }
    const decoder = new TextDecoder(encoding === 3 ? 'utf-8' : 'iso-8859-1');
    return decoder.decode(bytes).replace(/\u0000+$/, '');
  }

  async function read(url){
    const result = { title: null, artist: null, coverUrl: null };
    let bytes;
    try {
      const res = await fetch(url);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (err){
      return result; // e.g. blocked by CORS when opened over file:// instead of http(s)
    }

    if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33){
      return result; // no "ID3" marker at the start -> no ID3v2 tag to read
    }

    const majorVersion = bytes[3];
    const flags = bytes[5];
    const tagSize = syncsafeToInt(bytes.subarray(6, 10));
    let offset = 10;

    if (flags & 0x40){ // extended header present
      const extBytes = bytes.subarray(offset, offset + 4);
      offset += majorVersion >= 4 ? syncsafeToInt(extBytes) : bigEndianToInt(extBytes);
    }

    const tagEnd = Math.min(10 + tagSize, bytes.length);

    while (offset + 10 <= tagEnd){
      const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // hit padding

      const frameSize = majorVersion >= 4
        ? syncsafeToInt(bytes.subarray(offset + 4, offset + 8))
        : bigEndianToInt(bytes.subarray(offset + 4, offset + 8));
      const frameStart = offset + 10;
      const frameData = bytes.subarray(frameStart, frameStart + frameSize);

      if (frameId === 'TIT2' && frameData.length > 1){
        result.title = decodeText(frameData.subarray(1), frameData[0]);
      } else if (frameId === 'TPE1' && frameData.length > 1){
        result.artist = decodeText(frameData.subarray(1), frameData[0]);
      } else if (frameId === 'APIC' && frameData.length > 1){
        const encoding = frameData[0];
        let p = 1;
        while (p < frameData.length && frameData[p] !== 0) p++;
        const mime = decodeText(frameData.subarray(1, p), 0) || 'image/jpeg';
        p++; // skip MIME's null terminator
        p++; // skip picture-type byte
        if (encoding === 1 || encoding === 2){
          while (p + 1 < frameData.length && !(frameData[p] === 0 && frameData[p + 1] === 0)) p += 2;
          p += 2;
        } else {
          while (p < frameData.length && frameData[p] !== 0) p++;
          p += 1;
        }
        const imgBytes = frameData.subarray(p);
        if (imgBytes.length > 0){
          result.coverUrl = URL.createObjectURL(new Blob([imgBytes], { type: mime }));
        }
      }

      offset = frameStart + frameSize;
    }

    return result;
  }

  return { read };
})();

/* ---------- currently listening player ---------- */
(function(){
  // Add tracks here as { src }. Title, artist, and cover art are read
  // automatically from each file's ID3 tags no covers folder needed.
  // If a file has no tags (or tag-reading fails), pass optional
  // title/artist/cover as a fallback:
  // { src: "assets/audio/song.mp3", title: "...", artist: "...", cover: "..." }
    const TRACKS = [
    { src: "assets/audio/Wishing Star.mp3" },
    { src: "assets/audio/A STORY NOW TOLD.mp3" },
    { src: "assets/audio/rains.mp3" },
    { src: "assets/audio/The Orb Of Dreamers.mp3" },
    { src: "assets/audio/Girly Pop (pop music for girls).mp3" }
  ];

  const audio = document.getElementById('playerAudio');
  const artEl = document.getElementById('playerArt');
  const coverEl = document.getElementById('playerCover');
  const coverBackEl = document.getElementById('playerCoverBack');
  const titleEl = document.getElementById('playerTitle');
  const artistEl = document.getElementById('playerArtist');
  const playBtn = document.getElementById('playerPlay');
  const prevBtn = document.getElementById('playerPrev');
  const nextBtn = document.getElementById('playerNext');
  const muteBtn = document.getElementById('playerMute');
  const volumeSlider = document.getElementById('playerVolume');
  const progress = document.getElementById('playerProgress');
  const progressFill = document.getElementById('playerProgressFill');
  const curTimeEl = document.getElementById('playerCurrentTime');
  const durEl = document.getElementById('playerDuration');
  if (!audio || !artEl || TRACKS.length === 0) return;

  let index = 0;
  let loadToken = 0;
  let coverBlobUrl = null;

  function fmt(t){
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Use the audio file's own filename as the displayed title instead of
  // its embedded ID3 title tag, e.g. "assets/audio/Wishing Star.mp3" -> "Wishing Star".
  function filenameToTitle(src){
    const fileName = decodeURIComponent(src.split('/').pop() || '');
    return fileName.replace(/\.[^/.]+$/, '');
  }

  async function loadTrack(i, autoplay){
    index = (i + TRACKS.length) % TRACKS.length;
    const track = TRACKS[index];
    const myLoad = ++loadToken;

    audio.src = track.src;
    titleEl.textContent = track.title || filenameToTitle(track.src);
    artistEl.textContent = track.artist || '';
    coverEl.src = track.cover || '';
    if (coverBackEl) coverBackEl.src = track.cover || '';
    progressFill.style.width = '0%';
    progress.setAttribute('aria-valuenow', '0');
    curTimeEl.textContent = '0:00';
    durEl.textContent = '0:00';

    const tags = await ID3.read(track.src);
    if (myLoad !== loadToken){
      if (tags.coverUrl) URL.revokeObjectURL(tags.coverUrl); // a newer track loaded meanwhile
      return;
    }

    titleEl.textContent = track.title || filenameToTitle(track.src);
    artistEl.textContent = tags.artist || track.artist || 'Unknown artist';

    if (coverBlobUrl) URL.revokeObjectURL(coverBlobUrl);
    coverBlobUrl = tags.coverUrl || null;
    coverEl.src = tags.coverUrl || track.cover || '';
    coverEl.alt = `${titleEl.textContent} cover art`;
    if (coverBackEl) coverBackEl.src = tags.coverUrl || track.cover || '';

    if (autoplay) audio.play().catch(() => {});
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused){
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', () => playBtn.classList.add('is-playing'));
  audio.addEventListener('pause', () => playBtn.classList.remove('is-playing'));
  audio.addEventListener('loadedmetadata', () => { durEl.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    if (audio.duration){
      const pct = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = `${pct}%`;
      progress.setAttribute('aria-valuenow', String(Math.round(pct)));
      curTimeEl.textContent = fmt(audio.currentTime);
    }
  });
  audio.addEventListener('ended', () => loadTrack(index + 1, true));

  prevBtn.addEventListener('click', () => loadTrack(index - 1, !audio.paused));
  nextBtn.addEventListener('click', () => loadTrack(index + 1, !audio.paused));

  // Volume control, separate from the visitor's system/master volume.
  if (volumeSlider && muteBtn){
    let lastVolume = 0.7;
    audio.volume = lastVolume;

    function paintSlider(pct){
      volumeSlider.style.background =
        `linear-gradient(to right, var(--green) ${pct}%, rgba(220,247,221,0.12) ${pct}%)`;
    }
    function syncFromAudio(){
      const pct = audio.muted ? 0 : Math.round(audio.volume * 100);
      volumeSlider.value = String(pct);
      paintSlider(pct);
      muteBtn.setAttribute('aria-pressed', String(audio.muted || audio.volume === 0));
    }

    volumeSlider.addEventListener('input', () => {
      const val = Number(volumeSlider.value);
      audio.volume = val / 100;
      if (val > 0){
        audio.muted = false;
        lastVolume = audio.volume;
      }
      paintSlider(val);
      muteBtn.setAttribute('aria-pressed', String(val === 0));
    });

    muteBtn.addEventListener('click', () => {
      if (audio.muted || audio.volume === 0){
        audio.muted = false;
        audio.volume = lastVolume || 0.7;
      } else {
        lastVolume = audio.volume;
        audio.muted = true;
      }
      syncFromAudio();
    });

    syncFromAudio();
  }

  progress.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progress.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = pct * audio.duration;
  });

  // keep the art spinning whenever it's in view; pause it off-screen to save cycles
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window){
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => artEl.classList.toggle('paused', !entry.isIntersecting));
    }, { threshold: 0.1 });
    observer.observe(artEl);
  }

  loadTrack(0, false);

  // Browsers block audio autoplay until a genuine user gesture happens.
  // Treat the visitor's very first click anywhere on the page as that
  // gesture and kick off playback of whatever track is loaded.
  document.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
  }, { once: true });
})();