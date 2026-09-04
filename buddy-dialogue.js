/* ---------- talking sprite buddy: dialogue content ----------
   Pure content, no DOM/behavior logic. Add or edit lines here without
   touching script.js. Loaded before script.js and exposed as
   window.BuddyDialogue.
*/
(function(){

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
  function getTimeLine(){
    const now = new Date();
    const hour = now.getHours();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (hour < 5) return `it's ${timeStr} where you are... go to sleep ...or don't`;
    if (hour < 8) return `${timeStr}, huh? early riser or still up from last night?`;
    if (hour < 12) return `morning! it's ${timeStr} on your end`;
    if (hour < 17) return `it's ${timeStr} there 👀`;
    if (hour < 21) return `evening already, ${timeStr} for you`;
    return `${timeStr}...night owl`;
  }

  // A long-press gets its own reaction instead of just advancing to the
  // next line — a different kind of attention than a quick tap.
  const holdLines = ["...are you petting me?", "mmm, comfy", "this is nice ^-^", "that tickles!", "*squishing noises*", "aaaaaaaaaaaaaaaa", "IM GOING TO EXPLODE YOU", "blaerhghghhhh"];

  // Track- and artist-specific hold reactions. Checked in this order: an
  // exact song title match wins first (most specific), then an artist
  // substring match. Falls through to a random holdLines pick if nothing
  // matches. To add another callout, just add a row here — nothing else
  // needs to change.
  const HOLD_REACTIONS = [
    { type: 'title', match: 'dark waltz', line: "my timeless favorite" },
    { type: 'artist', match: 'dunni', line: "...dunni doesn't make music anymore, but their works still get me every time" },
    { type: 'artist', match: 'key after key', line: "genuinely addicted to this artist ever since their work on Boxing League" },
    { type: 'artist', match: 'snaptic', line: "snaptic makes great animations! check him out!" },
    { type: 'artist', match: 'spellcasting', line: "im glad they're getting more recognition, please do listen to their discography!" },
    { type: 'title', match: 'new normal', line: "this song means so much to me" },
    { type: 'title', match: 'notion', line: "You don't have to wait those salty decades\nto get through the gate, it's all in front of your face~ 🎵" },
    { type: 'title', match: 'i thought i saw your face today', line: "and I couldn't help but fall in love again~ 🎵" },
    { type: 'artist', match: 'ajr', line: "if you're still here somehow, this one is my absolute favorite" },
  ];

  window.BuddyDialogue = {
    lines,
    idleLines,
    rareLine,
    RARE_LINE_CHANCE,
    TIME_LINE_CHANCE,
    getTimeLine,
    holdLines,
    HOLD_REACTIONS
  };

})();