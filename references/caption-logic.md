# Caption-Aufbereitung: Whisper BPE-Tokens zu Woertern

## Warum BPE-Merge noetig ist

Whisper gibt Sub-Word-Tokens aus (Byte Pair Encoding). "Superintelligenz" kommt z.B. als `[" Super", "int", "ell", "igenz"]`. Diese muessen zu ganzen Woertern zusammengefuegt werden, sonst erscheinen Wortfragmente als einzelne Captions.

## Merge-Regeln

- Token mit fuehrendem Leerzeichen = neues Wort
- Token ohne Leerzeichen = Fortsetzung des vorherigen Worts
- Reine Satzzeichen-Tokens (`.`, `,`, `!`) werden uebersprungen
- Satzzeichen am Wortende werden entfernt
- Tokens mit `id >= 50000` sind Steuerzeichen → rausfiltern

## JavaScript-Implementierung

```javascript
function mergeTokensToWords(tokens) {
  const filtered = tokens.filter(t => t.id < 50000);
  const words = [];
  for (const tok of filtered) {
    const text = tok.text;
    if (/^[.,!?;:\"\-]+$/.test(text.trim())) continue;
    if (text.startsWith(' ')) {
      words.push({ text: text.trim(), fromMs: tok.offsets.from, toMs: tok.offsets.to });
    } else if (words.length > 0) {
      const prev = words[words.length - 1];
      prev.text += text;
      prev.toMs = tok.offsets.to;
    } else {
      words.push({ text: text.trim(), fromMs: tok.offsets.from, toMs: tok.offsets.to });
    }
  }
  // Satzzeichen am Ende entfernen
  for (const w of words) { w.text = w.text.replace(/[.,!?;:\"]+$/g, ''); }
  // Zero-Duration Fix: Tokens mit fromMs == toMs bekommen minimum 80ms Dauer
  for (const w of words) {
    if (w.toMs <= w.fromMs) { w.toMs = w.fromMs + 80; }
  }
  return words.filter(w => w.text.length > 0);
}

function buildCaptionPages(transcription, keywords, wordsPerPage = 3) {
  const kwLower = keywords.map(k => k.toLowerCase());
  let allWords = [];
  for (const seg of transcription) {
    allWords.push(...mergeTokensToWords(seg.tokens));
  }
  allWords = allWords.map(w => {
    const textLower = w.text.toLowerCase();
    const isKeyword = kwLower.some(kw =>
      textLower === kw || textLower.startsWith(kw) || (kw.startsWith(textLower) && textLower.length >= 5)
    );
    return { text: w.text, fromMs: w.fromMs, toMs: w.toMs, isKeyword };
  });
  const pages = [];
  for (let i = 0; i < allWords.length; i += wordsPerPage) {
    const pw = allWords.slice(i, i + wordsPerPage);
    pages.push({
      text: pw.map(w => w.text).join(' '),
      startMs: pw[0].fromMs,
      durationMs: pw[pw.length - 1].toMs - pw[0].fromMs,
      tokens: pw,
    });
  }
  return pages;
}
```

## Caption-Page Format (Props-JSON)

Jede Caption-Page hat dieses Format:
```json
{
  "text": "Das ist ein",
  "startMs": 0,
  "durationMs": 1200,
  "tokens": [
    { "text": "Das", "fromMs": 0, "toMs": 400, "isKeyword": false },
    { "text": "ist", "fromMs": 400, "toMs": 600, "isKeyword": false },
    { "text": "ein", "fromMs": 600, "toMs": 1200, "isKeyword": false }
  ]
}
```

## Wichtige Regeln

- **3 Woerter pro Page** (nicht 4-5) fuer bessere Lesbarkeit auf 9:16
- Keywords (`isKeyword: true`) werden automatisch gelb dargestellt
- Keyword-Matching: exakt, Prefix, oder Suffix (mind. 5 Zeichen)
- Timestamps sind Segment-relativ (starten bei 0ms) wenn Per-Segment-Transkription verwendet wird
