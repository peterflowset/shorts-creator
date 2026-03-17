const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/segments/segment_4_audio.wav.json", "utf8"));

const keywords = ["Agent", "abschalten", "abgeschaltet", "intelligent", "Motivation", "Kiste", "Rewards"];
const dash = String.fromCharCode(45);
const puncSet = new Set([".", ",", "!", "?", ";", ":", '"', dash]);

let allTokens = [];
for (const seg of data.transcription) {
  for (const tok of seg.tokens) {
    allTokens.push(tok);
  }
}

// Filter special tokens (id >= 50000)
allTokens = allTokens.filter(t => t.id < 50000);

// Merge BPE tokens to words
let words = [];
for (const tok of allTokens) {
  const text = tok.text;
  const fromMs = tok.offsets.from;
  const toMs = tok.offsets.to;

  // Skip pure punctuation
  if (puncSet.has(text.trim())) continue;

  if (text.startsWith(" ")) {
    // New word start
    words.push({
      text: text.trim(),
      fromMs: fromMs,
      toMs: toMs
    });
  } else {
    // Continuation of previous word
    if (words.length > 0) {
      words[words.length - 1].text += text;
      words[words.length - 1].toMs = toMs;
    }
  }
}

// Strip trailing punctuation from all words
words = words.map(w => {
  let t = w.text.replace(/[.,!?;:]+$/g, "");
  return Object.assign({}, w, { text: t });
}).filter(w => w.text.length > 0);

// Fix zero/negative duration: if toMs <= fromMs, set toMs = fromMs + 80
words = words.map(w => {
  if (w.toMs <= w.fromMs) {
    return Object.assign({}, w, { toMs: w.fromMs + 80 });
  }
  return w;
});

// Group into caption pages of 3 words each
const pages = [];
for (let i = 0; i < words.length; i += 3) {
  const chunk = words.slice(i, i + 3);
  const tokens = chunk.map(w => ({
    text: w.text,
    fromMs: w.fromMs,
    toMs: w.toMs,
    isKeyword: keywords.some(kw => w.text.toLowerCase() === kw.toLowerCase())
  }));
  const page = {
    text: chunk.map(w => w.text).join(" "),
    startMs: chunk[0].fromMs,
    durationMs: chunk[chunk.length - 1].toMs - chunk[0].fromMs,
    tokens: tokens
  };
  pages.push(page);
}

console.log(JSON.stringify(pages, null, 2));
