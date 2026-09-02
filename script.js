/* ---------- shared setup ----------
   reduceMotion is computed once here and reused by every section below,
   instead of each one re-querying matchMedia on its own.
   Sound (defined further down) is a plain top-level const, so every IIFE
   in this file can close over it — but that means Sound must stay defined
   before anything that calls it actually runs. Every call site below is
   deferred (inside an event handler or a setTimeout), so today's file
   order is safe; just keep Sound above the fold if you reorder sections. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shared with the "currently listening" player further down — same pattern
// as Sound above: a plain top-level object every IIFE can close over. The
// player writes the display title here on every track change; the buddy
// reads it to react to whatever's actually playing.
const NowPlaying = { title: null, artist: null };

/* ---------- art lightbox ---------- */
(function(){
  const tiles = Array.from(document.querySelectorAll('.art-tile'));
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightboxContent');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxThumbs = document.getElementById('lightboxThumbs');
  if (!lightbox || !tiles.length) return;
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
    document.dispatchEvent(new CustomEvent('lightbox:video-close')); // clear any prior video interrupt before swapping
    lightboxContent.innerHTML = '';
    if (type === 'video'){
      const video = document.createElement('video');
      video.src = full;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      lightboxContent.appendChild(video);
      document.dispatchEvent(new CustomEvent('lightbox:video-open'));
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
    document.dispatchEvent(new CustomEvent('lightbox:video-close'));
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
})();

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

/* ---------- generic hover/click sound ---------- */
/* Opt-out via data attributes rather than a hardcoded class list, so a
   future button that shouldn't sound just adds the attribute in its HTML
   instead of this block needing another edit.
   data-no-sound      -> skip both hover and click (e.g. the sound toggle
                          itself, which has its own bespoke confirm() sound)
   data-no-click-sound -> skip click only, keep hover (elements that already
                          fire their own click sound elsewhere: art tiles via
                          the lightbox, copy buttons, lightbox prev/next) */
(function(){
  document.querySelectorAll('a, button').forEach(el => {
    if (el.hasAttribute('data-no-sound')) return;
    el.addEventListener('mouseenter', () => Sound.hover());
    if (!el.hasAttribute('data-no-click-sound')){
      el.addEventListener('click', () => Sound.click());
    }
  });
})();

/* ---------- copy buttons ---------- */
(function(){
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
})();

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

/* ---------- project preview: tap-to-reveal on touch devices ---------- */
/* Hover already reveals this on mouse-driven devices (see CSS); touch
   devices have no hover state at all, so give them an explicit tap
   instead, without hijacking taps on the "visit" link itself. */
(function(){
  const boxes = Array.from(document.querySelectorAll('.project-box'));
  if (!boxes.length) return;

  const isTouchOnly = window.matchMedia('(hover: none)').matches;
  if (!isTouchOnly) return;

  boxes.forEach(box => {
    box.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // let the visit link navigate as normal
      const wasOpen = box.classList.contains('preview-open');
      boxes.forEach(b => b.classList.remove('preview-open'));
      if (!wasOpen) box.classList.add('preview-open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.project-box')){
      boxes.forEach(b => b.classList.remove('preview-open'));
    }
  });
})();

/* ---------- talking sprite buddy ---------- */
(function(){
  const buddy = document.getElementById('buddy');
  const bubble = document.getElementById('buddyBubble');
  const textEl = document.getElementById('buddyText');
  const moreEl = document.getElementById('buddyMore');
  const img = document.getElementById('buddyImg');
  const zzzContainer = document.getElementById('buddyZzz');
  if (!buddy) return;

  const IDLE_SRC = 'assets/sprite/idle.png';
  const TALK_SRC = 'assets/sprite/talk.png';
  const SHOCK_SRC = 'assets/sprite/shock.png';
  const SLEEP_SRC = 'assets/sprite/sleep.png';

  const lines = [
    "o! a visitor! o-o",
    "she/they, if that wasn't already clear from the bow",
    "still procrastinating on literally everything lol",
    "I didn't like page builders and I have more customizability here so...",
    "psst! the art section has some stuff I actually finished for once",
    "thanks for stopping by!",
    "...okay you can stop clicking me now. or don't, I'm not the boss of you"
  ];
  const idleLines = ["bleh", "la la la la \ud83c\udfb5", "i'm still becoming, and that's enough", "rahhh!", "i love my 'puter, all my friends are in it :3", "owieee", "💥"];
  // shows up occasionally instead of a normal idle line — a small
  // just-for-her secret the buddy keeps, not something meant to be found on
  // the first few clicks
  const rareLine = "...also, hi mom. I love you :3";
  const RARE_LINE_CHANCE = 0.05;

  // "Omniscient" is just Date() — every browser already reports time in the
  // visitor's own local clock, no geolocation or fetch needed. Picks a line
  // for whatever hour it happens to be on their end.
  const TIME_LINE_CHANCE = 0.15;
  let timeLineShown = false;
  function getTimeLine(){
    const now = new Date();
    const hour = now.getHours();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (hour < 5) return `it's ${timeStr} where you are... go to sleep. (or don't, I'm not the boss of you)`;
    if (hour < 8) return `${timeStr}, huh? early riser or still up from last night?`;
    if (hour < 12) return `morning! it's ${timeStr} on your end`;
    if (hour < 17) return `${timeStr} there — afternoon slump yet?`;
    if (hour < 21) return `evening already, ${timeStr} for you`;
    return `${timeStr}... night owl hours. relatable`;
  }
  let index = 0;
  let idleIndex = 0;
  let typing = false;
  let asleep = true;
  let typeTimer = null;
  let flapTimer = null;

  // A long-press gets its own reaction instead of just advancing to the
  // next line — a different kind of attention than a quick tap.
  const HOLD_MS = 550;
  let holdTimer = null;
  let isLongPress = false;
  const holdLines = ["...are you petting me?", "mmm, comfy", "this is nice ^-^", "that tickles!", "*squishing noises*", "aaaaaaaaaaaaaaaa", "IM GOING TO EXPLODE YOU", "blaerhghghhhh"];

  // Track- and artist-specific hold reactions. Checked in this order: an
  // exact song title match wins first (most specific), then an artist
  // substring match, both read live off NowPlaying (populated from ID3
  // metadata, or the TRACKS fallback fields, in the player below). Falls
  // through to a random holdLines pick if nothing matches. To add another
  // callout, just add a row here — nothing else needs to change.
  const HOLD_REACTIONS = [
    { type: 'title', match: 'dark waltz', line: 'my timeless favorite' },
    { type: 'artist', match: 'dunni', line: "...dunni doesn't make music anymore, but their works still get me every time" },
    { type: 'artist', match: 'key after key', line: 'genuinely addicted to this artist ever since their work on Boxing League' },
    { type: 'artist', match: 'snaptic', line: 'makes great animations! check him out!' },
    { type: 'artist', match: 'spellcasting', line: "im glad they're getting more recognition, please do listen to their discography!" }
  ];
  function holdReaction(){
    if (typing) return;
    const nowTitle = (NowPlaying.title || '').toLowerCase();
    const nowArtist = (NowPlaying.artist || '').toLowerCase();
    const matched = HOLD_REACTIONS.find(r =>
      r.type === 'title' ? nowTitle === r.match : nowArtist.includes(r.match)
    );
    if (matched){
      typeLine(matched.line, false);
      return;
    }
    const line = holdLines[Math.floor(Math.random() * holdLines.length)];
    typeLine(line, false);
  }

  // The full line is placed in the DOM immediately as one span per
  // character, each starting visibility:hidden. Hidden (not display:none)
  // spans still take up their layout space, so the bubble is already at its
  // true final size on frame one — "typing" is just flipping each
  // character's visibility over time, not growing the text itself. That's
  // what kills the resize-as-you-type "teleporting" box from before, and it
  // means there's no separate measuring step needed anymore.
  function typeLine(line, useShock){
    typing = true;
    moreEl.style.opacity = '0';
    clearInterval(typeTimer);
    clearInterval(flapTimer);

    textEl.innerHTML = '';
    const chars = Array.from(line).map(ch => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.visibility = 'hidden';
      textEl.appendChild(span);
      return span;
    });
    bubble.classList.add('show');

    if (reduceMotion){
      chars.forEach(span => { span.style.visibility = 'visible'; });
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
      const span = chars[i];
      span.style.visibility = 'visible';
      if (span.textContent.trim() !== '') Sound.type();
      i++;
      if (i >= chars.length){
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
    } else if (!timeLineShown && Math.random() < TIME_LINE_CHANCE){
      line = getTimeLine();
      useShock = false;
      timeLineShown = true;
    } else if (Math.random() < RARE_LINE_CHANCE){
      line = rareLine;
      useShock = false;
    } else {
      line = idleLines[idleIndex % idleLines.length];
      useShock = false;
      idleIndex++;
    }
    typeLine(line, useShock);
  }

  // Floating "Z"s while she's asleep — spawned one at a time rather than
  // three fixed elements looping, so they trail off in a diagonal line.
  // Capped at MAX_ZZZ on screen: the moment a new one spawns past the cap,
  // the oldest still-floating one is despawned immediately.
  const MAX_ZZZ = 3;
  const ZZZ_SPAWN_MS = 800;
  let zzzTimer = null;

  function spawnZ(){
    if (!zzzContainer) return;
    while (zzzContainer.children.length >= MAX_ZZZ){
      zzzContainer.removeChild(zzzContainer.firstElementChild);
    }
    const z = document.createElement('span');
    z.className = 'zzz-z';
    z.textContent = 'Z';
    z.style.setProperty('--zx', `${(Math.random() * 10 - 5).toFixed(1)}px`);
    z.addEventListener('animationend', () => z.remove());
    zzzContainer.appendChild(z);
  }

  function startZzz(){
    stopZzz();
    if (!zzzContainer) return;
    if (reduceMotion){
      const z = document.createElement('span');
      z.className = 'zzz-z zzz-static';
      z.textContent = 'zzz';
      zzzContainer.appendChild(z);
      return;
    }
    spawnZ();
    zzzTimer = setInterval(spawnZ, ZZZ_SPAWN_MS);
  }

  function stopZzz(){
    clearInterval(zzzTimer);
    zzzTimer = null;
    if (zzzContainer) zzzContainer.innerHTML = '';
  }

  // She loads asleep. Waking her up is the visitor's first real tap on the
  // page doubling as the guaranteed user gesture the audio player needs
  // rather than a silent hidden listener, this is an honest, on-theme way
  // to ask for it.
  function wake(){
    asleep = false;
    buddy.classList.remove('asleep');
    stopZzz();
    buddy.setAttribute('aria-label', 'elle. Click for another line.');
    img.src = SHOCK_SRC; // startled the moment she wakes up
    setTimeout(() => {
      nextLine();
    }, reduceMotion ? 50 : 1500);
  }

  buddy.addEventListener('click', () => {
    if (asleep){
      wake();
      return;
    }
    if (isLongPress){
      isLongPress = false; // holdReaction() already spoke; don't also advance
      return;
    }
    nextLine();
  });

  // Purely visual press feedback — kept separate from nextLine() above so
  // it fires on every tap, even while a line is still typing out and the
  // click itself is being ignored.
  buddy.addEventListener('pointerdown', () => {
    buddy.classList.add('squish');
    if (asleep) return;
    isLongPress = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      isLongPress = true;
      holdReaction();
    }, HOLD_MS);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    buddy.addEventListener(evt, () => {
      buddy.classList.remove('squish');
      clearTimeout(holdTimer);
    });
  });

  window.addEventListener('load', () => {
    setTimeout(() => {
      buddy.classList.add('revealed');
      buddy.classList.add('asleep');
      buddy.setAttribute('aria-label', 'elle is asleep. Click to wake her up.');
      img.src = SLEEP_SRC;
      startZzz();
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
    { src: "assets/audio/Girly Pop (pop music for girls).mp3" },
    { src: "assets/audio/DVD.mp3" },
    { src: "assets/audio/Ultimatum.mp3" },
    { src: "assets/audio/the song that plays at the beach on your favorite childhood game.mp3" },
    { src: "assets/audio/dancing around in circles until my little feet fall off.mp3" },
    { src: "assets/audio/Dark Waltz.mp3" }
  ];

  const audio = document.getElementById('playerAudio');
  const artEl = document.getElementById('playerArt');
  const coverEl = document.getElementById('playerCover');
  const coverBackEl = document.getElementById('playerCoverBack');
  const titleEl = document.getElementById('playerTitle');
  const titleTrackEl = document.getElementById('playerTitleTrack');
  const titleItemEl = document.getElementById('playerTitleItem');
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

  // Same idea as the status ticker up top: only scroll when the text
  // actually doesn't fit, so most (short) song titles just sit still at
  // their normal single-line height instead of the box growing to wrap a
  // long one. When it does need to scroll, a second aria-hidden copy is
  // appended with a gap so the loop is seamless, same trick the ticker uses.
  const TITLE_PIXELS_PER_SECOND = 34;
  const TITLE_GAP = 40;
  function updateTitleMarquee(){
    if (!titleTrackEl || !titleItemEl) return;
    titleTrackEl.classList.remove('scrolling');
    titleTrackEl.style.animationDuration = '';
    Array.from(titleTrackEl.children).forEach((child, i) => { if (i > 0) child.remove(); });

    const containerWidth = titleEl.clientWidth;
    const textWidth = titleItemEl.scrollWidth;
    if (reduceMotion || textWidth <= containerWidth) return;

    titleTrackEl.style.setProperty('--title-gap', `${TITLE_GAP}px`);
    const clone = titleItemEl.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    titleTrackEl.appendChild(clone);

    const halfWidth = textWidth + TITLE_GAP;
    const duration = Math.max(halfWidth / TITLE_PIXELS_PER_SECOND, 4);
    titleTrackEl.style.animationDuration = `${duration}s`;
    titleTrackEl.classList.add('scrolling');
  }

  let titleResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(titleResizeTimer);
    titleResizeTimer = setTimeout(updateTitleMarquee, 150);
  });

  async function loadTrack(i, autoplay){
    index = (i + TRACKS.length) % TRACKS.length;
    const track = TRACKS[index];
    const myLoad = ++loadToken;

    audio.src = track.src;
    titleItemEl.textContent = track.title || filenameToTitle(track.src);
    NowPlaying.title = titleItemEl.textContent;
    updateTitleMarquee();
    artistEl.textContent = track.artist || '';
    NowPlaying.artist = track.artist || null;
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

    titleItemEl.textContent = track.title || filenameToTitle(track.src);
    artistEl.textContent = tags.artist || track.artist || 'Unknown artist';
    NowPlaying.title = titleItemEl.textContent;
    NowPlaying.artist = artistEl.textContent;
    updateTitleMarquee();

    if (coverBlobUrl) URL.revokeObjectURL(coverBlobUrl);
    coverBlobUrl = tags.coverUrl || null;
    coverEl.src = tags.coverUrl || track.cover || '';
    coverEl.alt = `${titleItemEl.textContent} cover art`;
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

  let refreshVolumeUI = () => {};

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
    refreshVolumeUI = syncFromAudio;
  }

  progress.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progress.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = pct * audio.duration;
  });

  // keep the art spinning whenever it's in view; pause it off-screen to save cycles
  if (!reduceMotion && 'IntersectionObserver' in window){
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => artEl.classList.toggle('paused', !entry.isIntersecting));
    }, { threshold: 0.1 });
    observer.observe(artEl);
  }

  // Pause the player outright while a lightbox video is open, and resume
  // afterward only if it was actually playing beforehand.
  let resumeAfterVideo = false;
  document.addEventListener('lightbox:video-open', () => {
    if (!audio.paused){
      resumeAfterVideo = true;
      audio.pause();
    }
  });
  document.addEventListener('lightbox:video-close', () => {
    if (resumeAfterVideo){
      resumeAfterVideo = false;
      audio.play().catch(() => {});
    }
  });

  // Duck (not pause) the volume when the visitor switches to another tab
  // or app, then restore it once this tab is focused again — same idea as
  // background-audio ducking in Spotify/Discord, rather than a hard stop.
  const DUCK_LEVEL = 0.15;
  let volumeBeforeDuck = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){
      if (volumeBeforeDuck === null && !audio.muted){
        volumeBeforeDuck = audio.volume;
        audio.volume = Math.min(audio.volume, DUCK_LEVEL);
      }
    } else if (volumeBeforeDuck !== null){
      audio.volume = volumeBeforeDuck;
      volumeBeforeDuck = null;
      refreshVolumeUI();
    }
  });

  loadTrack(0, false);

  // Browsers block audio autoplay until a genuine user gesture happens.
  // Treat the visitor's very first click anywhere on the page as that
  // gesture and kick off playback of whatever track is loaded.
  document.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
  }, { once: true });
})();