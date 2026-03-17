---
name: create-shorts
description: Erstellt automatisiert Kurzvideos (Shorts) aus Long-Form Videos. Analysiert visuell und inhaltlich, identifiziert virale Segmente, waehlt smartes Cropping (Single/Split/Slide), fuegt B-Roll Stock Footage hinzu, rendert Shorts mit animierten Captions und Branding. Verwende diesen Skill wenn der User Shorts erstellen, Videos schneiden, Kurzvideos aus Podcasts/Interviews generieren, oder Content fuer TikTok/YouTube Shorts/Reels produzieren will.
command: create-shorts
arguments: "[<pfad-zur-videodatei>]"
allowed-tools: Bash(ffmpeg *), Bash(whisper-cli *), Bash(npx remotion *), Bash(python3 *), Bash(npm *), Bash(rclone *), Bash(cp *), Bash(mkdir *), Bash(ls *), Bash(open *)
---

# /create-shorts - Automatisierte Kurzvideos aus Long-Form Content

Du bist ein erfahrener Video-Editor und Content-Stratege. Fuehre die folgende Pipeline Schritt fuer Schritt aus.

**Zwei Modi:**
- `/create-shorts` (ohne Argument) → Holt neue Videos von Google Drive, verarbeitet alle
- `/create-shorts <video-pfad>` → Verarbeitet das angegebene Video direkt (ueberspringe Schritt 0)

## Installation

```bash
git clone https://github.com/peterflowset/shorts-creator.git ~/.claude/skills/create-shorts
```

Danach steht `/create-shorts` als Skill zur Verfuegung.

## Schritt -1: Auto-Setup (einmalig)

Laeuft nur beim ERSTEN Aufruf. Pruefe und installiere fehlende Abhaengigkeiten.

### System-Tools

```bash
# macOS (Homebrew)
which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
which ffmpeg || brew install ffmpeg
which node || brew install node
which whisper-cli || brew install whisper-cpp
```

### Whisper-Modell

Suche in dieser Reihenfolge, speichere als `$WHISPER_MODEL`:
1. `$(brew --prefix)/share/whisper-cpp/ggml-large-v3.bin`
2. `$HOME/.local/share/whisper-cpp/ggml-large-v3.bin`
3. Falls keiner existiert → herunterladen nach Option 2:
```bash
mkdir -p "$HOME/.local/share/whisper-cpp"
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin" \
  -o "$HOME/.local/share/whisper-cpp/ggml-large-v3.bin"
```

### Node-Dependencies

```bash
cd "${CLAUDE_SKILL_DIR}" && [ -d "node_modules" ] || npm install
```

### Verzeichnisse + optionale Tools

```bash
mkdir -p "${CLAUDE_SKILL_DIR}/data/segments" "${CLAUDE_SKILL_DIR}/data/renders"
```

Optionale Features (NICHT blockierend):
- **B-Roll**: `PEXELS_API_KEY` in `~/.zshrc` → ohne B-Roll weiterrendern falls fehlend
- **Google Drive**: `rclone` → Shorts werden lokal gespeichert falls fehlend

## Schritt 0: Videos von Google Drive holen (nur ohne Argument)

Ueberspringe falls lokaler Pfad angegeben oder rclone nicht installiert.

```bash
INBOX_DIR="$HOME/Podcasts/inbox" && mkdir -p "$INBOX_DIR"
rclone move "gdrive:Input-Longform/" "$INBOX_DIR/" --include "*.mp4" --verbose
```

## Schritt 1: Vorbereitung

```bash
cd "${CLAUDE_SKILL_DIR}"
mkdir -p data/segments data/renders
```

Alle folgenden Befehle aus `${CLAUDE_SKILL_DIR}` heraus.

## Schritt 2: Audio extrahieren + Transkribieren

```bash
ffmpeg -i <INPUT_VIDEO> -ar 16000 -ac 1 -c:a pcm_s16le data/segments/audio.wav -y
whisper-cli -m "$WHISPER_MODEL" -l de -ojf data/segments/audio.wav
```

## Schritt 3: Visuelle Analyse (KRITISCH)

**Phase 1: Uebersicht** — Extrahiere Frames alle 30s, analysiere mit Read Tool:
```bash
ffmpeg -i <INPUT_VIDEO> -vf "fps=1/30" -q:v 2 data/segments/frame_%04d.jpg -y
```

Erstelle eine **Kamera-Timeline**: Kameratyp (Solo/Interview/Slide/B-Roll), Personenposition, Qualitaet (Hoch/Mittel/Niedrig), Framing (Nah/Medium/Weit), Wechsel-Zeitpunkte.

**Strategie-Regeln:**
- Niedrige Qualitaet / Nahaufnahme → `layout: "split"` bevorzugen
- Hohe Qualitaet + Medium/Weit → `layout: "single"` + `cropMode: "center"`
- **KEIN Letterbox** fuer TikTok/Shorts
- **Side-by-Side Interview → IMMER `layout: "split"`**, nie single mit left/right crop

**Phase 2: Pro-Segment-Verifikation** — Nach Segmentwahl, Frames alle 3-5s extrahieren:
```bash
ffmpeg -i <SEGMENT_VIDEO> -vf "fps=1/3" -q:v 2 data/segments/seg<N>_verify_%02d.jpg -y
```
Kameraansicht muss durchgehend konsistent sein. Kamerawechsel = Segment disqualifiziert.

## Schritt 4: Transkript verstehen

Lies `data/segments/audio.wav.json`. Zusammenfassung: Thema, Format, Hoehepunkte, Standalone-Stellen.

## Schritt 5: Segmente identifizieren

Beste Segmente waehlen (25-35s ideal, max 45s). Jedes Segment muss:
- Eigenstaendig funktionieren (ohne Kontext verstaendlich)
- Starken Einstieg haben (erste 3s fesseln)
- **An natuerlichen Satzgrenzen anfangen und enden**
- **Mind. 2s Puffer nach letztem Wort**

**Layout-Diversitaet (PFLICHT):** Mind. 30% anderes Layout als Mehrheit wenn Quellvideo verschiedene Ansichten bietet.

```json
{
  "index": 0, "title": "Kurzer Titel",
  "hookText": "Kann man SUPERINTELLIGENZ kontrollieren?",
  "startMs": 12000, "endMs": 47000, "viralScore": 8,
  "keywords": ["Wort1", "Wort2"], "layout": "single", "cropMode": "center"
}
```

**hookText:** Genau 1 Keyword GROSSSCHREIBEN → wird automatisch gelb.

| Layout | Wann | Beschreibung |
|--------|------|-------------|
| `single` | Einzelperson | 9:16 Crop |
| `split` | Zwei Personen / niedrige Qualitaet | Split-Screen oben/unten |
| `slide` | NUR Praesentationen mit lesbarem Text | Vollbild — NICHT fuer Webcam! |

| CropMode | Wann (nur bei single) |
|----------|----------------------|
| `center` | Person mittig (Standard) |
| `left` | Person links (25%) |
| `right` | Person rechts (75%) |

## Schritt 6: Video-Segmente schneiden

OHNE 9:16 Crop — Remotion uebernimmt Layout:
```bash
ffmpeg -i <INPUT_VIDEO> -ss <START_SEC> -t <DURATION_SEC> \
  -c:v libx264 -preset fast -c:a aac data/segments/segment_<N>.mp4 -y
cp data/segments/segment_<N>.mp4 public/segment_<N>.mp4
```

### 6b: Per-Segment Transkription (Caption-Sync)

Audio aus GESCHNITTENEM Segment extrahieren und separat transkribieren → Timestamps starten bei 0ms:
```bash
ffmpeg -i data/segments/segment_<N>.mp4 -ar 16000 -ac 1 -c:a pcm_s16le data/segments/segment_<N>_audio.wav -y
whisper-cli -m "$WHISPER_MODEL" -l de -ojf data/segments/segment_<N>_audio.wav
```

### 6c: Fuellwoerter/Stotter-Trimming

Erkenne: `aehm`, `aeh`, `ehm`, `mmm`, `hmm`, Wort-Wiederholungen, Versprecher, Pausen >800ms.
50ms Padding, Bereiche <150ms zusammenfuegen, >30% entfernt → User warnen.

```bash
ffmpeg -i data/segments/segment_<N>.mp4 -filter_complex "
  [0:v]trim=start=0:end=1.15,setpts=PTS-STARTPTS[v0];
  [0:a]atrim=start=0:end=1.15,asetpts=PTS-STARTPTS[a0];
  [0:v]trim=start=1.95:end=5.05,setpts=PTS-STARTPTS[v1];
  [0:a]atrim=start=1.95:end=5.05,asetpts=PTS-STARTPTS[a1];
  [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]
" -map "[outv]" -map "[outa]" -c:v libx264 -preset fast -c:a aac data/segments/segment_<N>_trimmed.mp4 -y
```

Nach Trimming: erneut transkribieren, nach `public/` kopieren. Ohne Trimming: Transkript aus 6b verwenden.

## Schritt 7: Captions vorbereiten

Verwende Segment-Transkript aus 6b/6c (NICHT Gesamt-Transkript). Fuer die BPE-Token-Merge-Logik und Caption-Page-Aufbau siehe **[references/caption-logic.md](references/caption-logic.md)**.

3 Woerter pro Page. Keywords aus Segment-Definition werden automatisch gelb.

### 7b: Automatische Overlays

| Typ | Wann | durationMs |
|-----|------|-----------|
| `stat` | Zahlen/Statistiken im Transkript | 2000 |
| `cta` | 1x pro Video bei ~70% Dauer | 2000 |

Max 2-3 Overlays, keine in ersten 4s/letzten 3s, min 3s Abstand, keine Emojis.

### 7c: B-Roll Stock Footage

Ueberspringe falls `PEXELS_API_KEY` nicht gesetzt. DU waehlst **englische** Suchbegriffe (2-3 Woerter, visuell, cinematic, Bewegung bevorzugen).

```bash
cd "${CLAUDE_SKILL_DIR}" && \
python3 scripts/generate_ai_clips.py data/segments/props_<N>.json \
  --queries "suchbegriff1,suchbegriff2,suchbegriff3"
```

## Schritt 8: Shorts rendern

Props-JSON ZUERST schreiben (mit `aiClips: []`), DANN `generate_ai_clips.py`, DANN rendern:

```javascript
const props = {
  videoSrc: "segment_<N>.mp4",
  captions: captionPages,
  hookText: "Hook mit einem KEYWORD gross",
  hookDurationFrames: 90,
  layout: "single",           // "single" | "split" | "slide"
  cropMode: "center",         // "center" | "left" | "right"
  captionPosition: "bottom",  // "top" | "center" | "bottom" — nicht ueber Gesicht!
  aiClips: [],
  overlays: overlays,
};
```

```bash
cd "${CLAUDE_SKILL_DIR}" && \
npx remotion render ShortVideo data/renders/short_<N>.mp4 \
  --props=data/segments/props_<N>.json
```

### 8b: Qualitaetspruefung (QA-Loop)

Pflicht nach jedem Render. Siehe **[references/qa-checks.md](references/qa-checks.md)** fuer die vollstaendige Checkliste.

Kurzfassung: Frames alle 3s extrahieren, visuell pruefen (Crop, Caption-Overlap, Layout-Match, B-Roll, Kamerawechsel, abruptes Ende). Bei Fehler: fixen, neu rendern, max 2 Iterationen.

## Schritt 9: Beschreibung + Hashtags

Erstelle `data/renders/short_<N>_description.txt`: Titel, 2-3 packende Saetze, 5-10 Hashtags (DE+EN Mix).

## Schritt 10: Google Drive Upload (optional)

Ueberspringe falls rclone fehlt oder lokaler Video-Pfad verwendet.

```bash
VIDEO_STEM="<name-ohne-extension>"
rclone copyto "data/renders/short_<N>.mp4" "gdrive:Output-Shorts/${VIDEO_STEM}/short_<N>.mp4" --verbose
rclone copyto "data/renders/short_<N>_description.txt" "gdrive:Output-Shorts/${VIDEO_STEM}/short_<N>_description.txt" --verbose
```

## Schritt 11: Zusammenfassung

```
| # | Titel | Score | Dauer | Layout | B-Roll | Datei |
|---|-------|-------|-------|--------|--------|-------|
| 0 | ...   | 8/10  | 40s   | single | 3 Clips | data/renders/short_0.mp4 |
```

`open data/renders/short_*.mp4`

## Technische Hinweise

- Whisper: `whisper-cli` (nicht `whisper-cpp`), Modell als `$WHISPER_MODEL`
- Remotion: `${CLAUDE_SKILL_DIR}` ist das Projekt. Videos in `public/` fuer `staticFile()`
- Duration: automatisch aus tatsaechlicher Video-Dateilaenge via `getVideoMetadata()` (keine Freeze Frames)
- Segmente OHNE 9:16 Crop schneiden
- Side-by-Side Interview → IMMER `layout: "split"`
- `generate_ai_clips.py` mit `--queries` (Claude waehlt Begriffe)
