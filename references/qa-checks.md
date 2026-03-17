# Automatische Qualitaetspruefung (QA-Loop)

Nach dem Rendern wird JEDES Short automatisch visuell geprueft. Dieser Schritt ist NICHT optional.

## Frames extrahieren

```bash
ffmpeg -i data/renders/short_<N>.mp4 -vf "fps=1/3" -q:v 2 data/segments/qa_<N>_%02d.jpg -y
```

## Pruef-Checkliste

Pruefe mit dem Read Tool JEDEN Frame auf folgende Fehler:

| Check | Was pruefen | Fail-Kriterium |
|-------|------------|----------------|
| **Crop-Check** | Sind Personen abgeschnitten? | Gesicht/Koerper am Bildrand abgeschnitten |
| **Caption-Overlap** | Ueberschneiden sich Captions mit Text im Video? | Caption ueberlappt mit Slide-Text, Lower-Thirds |
| **Caption-Gesicht** | Liegen Captions ueber dem Gesicht? | Caption verdeckt Augen/Mund |
| **Layout-Match** | Passt Layout zum Quellmaterial? | Single-Crop auf Side-by-Side-Interview |
| **B-Roll-Artefakte** | Sehen B-Roll-Einblendungen sauber aus? | Schwarze Balken, verzerrte Bilder |
| **Kamerawechsel** | Ungewollte Szenenwechsel? | Ploetzlich andere Kameraansicht |
| **Abruptes Ende** | Endet das Video natuerlich? | Letztes Wort im allerletzten Frame |

## Fehler-Behebung

**Bei FAIL:** Fix durchfuehren, neu rendern, nochmal pruefen (max 2 Iterationen).

### Haeufige Fixes

| Problem | Loesung |
|---------|---------|
| Person abgeschnitten | `cropMode` aendern (`center` → `left`/`right`) oder `layout: "split"` |
| Caption ueberlappt Video-Text | `captionPosition` aendern (`bottom` → `top` oder umgekehrt) |
| Caption ueber Gesicht | `captionPosition` aendern |
| Single-Crop auf Split-Bild | `layout: "split"` setzen |
| B-Roll verzerrt | Clip aus `aiClips[]` entfernen |
| Kamerawechsel | Segment kuerzer schneiden (vor dem Wechsel enden) |
| Abruptes Ende | Segment mit mehr Puffer schneiden (mind. 2s nach letztem Wort) |

**Bei allen OK:** Weiter zu Beschreibung + Upload.
