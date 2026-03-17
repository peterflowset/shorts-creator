#!/usr/bin/env bash
#
# auto_shorts.sh — Automatic Shorts Pipeline
#
# Downloads new podcast videos from Google Drive, generates shorts
# via Claude /create-shorts, and uploads results to Google Drive or YouTube.
#
# Intended to run via cron every 3 days.

set -euo pipefail

# ── Ensure PATH includes Homebrew and npm-global (cron has minimal env) ──
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"

# Allow claude -p to run even if launched from within a Claude Code session
unset CLAUDECODE

# ── Paths ──────────────────────────────────────────────────────────
INBOX_DIR="$HOME/Podcasts/inbox"
DONE_DIR="$HOME/Podcasts/done"
LOG_DIR="$HOME/Podcasts/logs"
SHORTS_CREATOR="$HOME/Everlast/shorts-creator"
RENDERS_DIR="$SHORTS_CREATOR/data/renders"
SCRIPTS_DIR="$SHORTS_CREATOR/scripts"

GDRIVE_REMOTE="gdrive:Podcasts/inbox/"
GDRIVE_OUTPUT="gdrive:Podcasts/fertig/"
PYTHON="$SCRIPTS_DIR/.venv/bin/python3"

# Set to "youtube" for YouTube upload, "gdrive" for Google Drive output
UPLOAD_MODE="gdrive"

# ── Logging ────────────────────────────────────────────────────────
TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/run_${TIMESTAMP}.log"
mkdir -p "$INBOX_DIR" "$DONE_DIR" "$LOG_DIR"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "=== Auto Shorts Pipeline — $TIMESTAMP ==="

# ── Step 1: Download new videos from Google Drive ──────────────────
echo ""
echo "[1/4] Downloading new videos from Google Drive..."
rclone move "$GDRIVE_REMOTE" "$INBOX_DIR/" --include "*.mp4" --verbose
echo "Download complete."

# ── Check if there are any videos to process ───────────────────────
shopt -s nullglob
VIDEOS=("$INBOX_DIR"/*.mp4)
shopt -u nullglob

if [ ${#VIDEOS[@]} -eq 0 ]; then
    echo "No new videos found in inbox. Exiting."
    exit 0
fi

echo "Found ${#VIDEOS[@]} video(s) to process."

# ── Step 2: Process each video ─────────────────────────────────────
for VIDEO in "${VIDEOS[@]}"; do
    VIDEO_NAME=$(basename "$VIDEO")
    VIDEO_STEM="${VIDEO_NAME%.mp4}"
    echo ""
    echo "============================================"
    echo "[2/4] Processing: $VIDEO_NAME"
    echo "============================================"

    # Record timestamp BEFORE processing to detect new/modified files
    BEFORE_TS=$(date +%s)

    # Run Claude /create-shorts
    echo "Running /create-shorts..."
    if ! claude -p "/create-shorts $VIDEO" \
        --allowedTools "Bash,Read,Edit,Write,Glob,Grep,Task" \
        --max-turns 150; then
        echo "ERROR: /create-shorts failed for $VIDEO_NAME" >&2
        continue
    fi
    echo "/create-shorts completed."

    # ── Auto-render if Claude prepared props but didn't render ─────
    # Find renders modified AFTER processing started
    declare -a NEW_SHORTS=()
    for f in "$RENDERS_DIR"/short_*.mp4; do
        [ -f "$f" ] || continue
        if [ "$(stat -f %m "$f")" -ge "$BEFORE_TS" ]; then
            NEW_SHORTS+=("$f")
        fi
    done

    if [ ${#NEW_SHORTS[@]} -eq 0 ]; then
        # No new renders — find new/modified props and render them
        declare -a NEW_PROPS=()
        for p in "$SHORTS_CREATOR"/data/segments/props_*.json; do
            [ -f "$p" ] || continue
            if [ "$(stat -f %m "$p")" -ge "$BEFORE_TS" ]; then
                NEW_PROPS+=("$p")
            fi
        done

        if [ ${#NEW_PROPS[@]} -gt 0 ]; then
            # ── Generate B-roll stock footage clips before rendering ──
            echo "Fetching B-roll stock footage for ${#NEW_PROPS[@]} props file(s)..."
            for PROPS in "${NEW_PROPS[@]}"; do
                echo "  B-roll: $(basename "$PROPS")"
                if "$PYTHON" "$SCRIPTS_DIR/generate_ai_clips.py" "$PROPS"; then
                    echo "  B-roll clips added for $(basename "$PROPS")"
                else
                    echo "  WARNING: B-roll fetch failed for $(basename "$PROPS"), rendering without B-roll" >&2
                fi
            done

            echo "No new rendered shorts — auto-rendering from ${#NEW_PROPS[@]} new props file(s)..."
            for PROPS in "${NEW_PROPS[@]}"; do
                PROPS_BASE=$(basename "$PROPS" .json)
                SHORT_NAME=$(echo "$PROPS_BASE" | sed 's/^props_/short_/' | sed 's/_new$//')
                OUTPUT="$RENDERS_DIR/${SHORT_NAME}.mp4"

                echo "Rendering: $SHORT_NAME (from $PROPS_BASE)"
                if (cd "$SHORTS_CREATOR" && npx remotion render ShortVideo "$OUTPUT" --props="$PROPS"); then
                    echo "Rendered: $OUTPUT"
                    NEW_SHORTS+=("$OUTPUT")
                else
                    echo "ERROR: Render failed for $PROPS_BASE" >&2
                fi
            done
        fi
    fi

    if [ ${#NEW_SHORTS[@]} -eq 0 ]; then
        echo "WARNING: No new shorts generated for $VIDEO_NAME"
        continue
    fi

    echo "Generated ${#NEW_SHORTS[@]} new short(s)."

    # ── Step 3: Upload generated shorts ─────────────────────────────
    echo ""

    if [ "$UPLOAD_MODE" = "gdrive" ]; then
        # ── Google Drive: upload shorts + descriptions to Podcasts/fertig/<video>/ ──
        GDRIVE_DEST="${GDRIVE_OUTPUT}${VIDEO_STEM}/"
        echo "[3/4] Uploading to Google Drive → ${GDRIVE_DEST}"

        for SHORT in "${NEW_SHORTS[@]}"; do
            SHORT_FILENAME=$(basename "$SHORT")
            SHORT_BASE="${SHORT_FILENAME%.mp4}"
            DESC_FILE="$RENDERS_DIR/${SHORT_BASE}_description.txt"

            echo "  Uploading: $SHORT_FILENAME"
            rclone copyto "$SHORT" "${GDRIVE_DEST}${SHORT_FILENAME}" --verbose

            if [ -f "$DESC_FILE" ]; then
                DESC_FILENAME=$(basename "$DESC_FILE")
                echo "  Uploading: $DESC_FILENAME"
                rclone copyto "$DESC_FILE" "${GDRIVE_DEST}${DESC_FILENAME}" --verbose
            fi
        done
        echo "Uploaded to Google Drive."

    else
        # ── YouTube: upload as private drafts ──
        echo "[3/4] Uploading shorts to YouTube..."
        for SHORT in "${NEW_SHORTS[@]}"; do
            SHORT_BASE=$(basename "$SHORT" .mp4)
            DESC_FILE="$RENDERS_DIR/${SHORT_BASE}_description.txt"

            if [ ! -f "$DESC_FILE" ]; then
                echo "WARNING: No description file for $SHORT_BASE, skipping upload."
                continue
            fi

            echo "Uploading: $SHORT_BASE"
            if "$PYTHON" "$SCRIPTS_DIR/upload_youtube.py" "$SHORT" "$DESC_FILE"; then
                echo "Uploaded: $SHORT_BASE"
            else
                echo "ERROR: Upload failed for $SHORT_BASE" >&2
            fi
        done
    fi

    # ── Step 4: Move processed video to done/ ──────────────────────
    echo ""
    echo "[4/4] Moving $VIDEO_NAME to done/"
    mv "$VIDEO" "$DONE_DIR/"
    echo "Done: $VIDEO_NAME"
done

echo ""
echo "=== Pipeline finished — $(date "+%Y-%m-%d %H:%M:%S") ==="
