#!/usr/bin/env python3
"""
generate_ai_clips.py — Add B-roll stock footage clips to Shorts via Pexels API

Usage:
  python3 generate_ai_clips.py <props.json> [--dry-run]

Reads captions from props JSON, finds insertion points based on keywords,
searches Pexels for matching portrait stock footage, downloads clips,
and updates the props JSON with an aiClips[] array.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

# ── Config ──────────────────────────────────────────────────────────
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "YOUR_API_KEY_HERE")
PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"

CLIP_DISPLAY_MS = 3500         # show 3.5s of each clip
CLIP_INTERVAL_MS = 12500       # target: ~1 clip per 10-15s
MIN_CLIP_SPACING_MS = 8000     # minimum gap between clips
AVOID_START_MS = 4000          # skip first 4s (hook/title card)
AVOID_END_MS = 3000            # skip last 3s (outro)
MIN_VIDEO_DURATION_SEC = 4     # minimum Pexels video length

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

# ── Keyword → visual B-roll concept ─────────────────────────────────
# Maps German keywords to short, focused Pexels search queries.
# Each value is ONE visual concept (2-3 words max) that looks good as B-roll.
KEYWORD_MAP = {
    # AI / Tech
    "agent": "robot closeup",
    "ki": "artificial intelligence",
    "künstliche": "artificial intelligence",
    "intelligenz": "neural network",
    "intelligent": "brain neurons",
    "modell": "neural network",
    "algorithmus": "code screen",
    "daten": "data server",
    "training": "computer processing",
    "neuronal": "brain neurons",
    "roboter": "robot closeup",
    "computer": "computer screen dark",
    "programmieren": "coding dark",
    "software": "code screen dark",
    "technologie": "technology futuristic",
    "digital": "digital abstract",
    "automatisierung": "robot arm factory",
    "zukunft": "futuristic city",
    "abschalten": "switch off dark",
    "abgeschaltet": "dark screen",
    "motivation": "person determined",
    "reward": "golden trophy",
    "rewards": "golden trophy",
    # Business
    "startup": "startup office",
    "unternehmen": "business office",
    "marketing": "social media phone",
    "kunden": "handshake business",
    "umsatz": "stock chart",
    "wachstum": "plant growing",
    "strategie": "chess strategy",
    "team": "team meeting",
    # General
    "problem": "maze puzzle",
    "lösung": "lightbulb idea",
    "erfolg": "mountain summit",
    "fehler": "warning alert",
    "risiko": "tightrope balance",
    "chance": "open door light",
    "wert": "diamond closeup",
    "kiste": "mystery box dark",
}

# Fallback pool — visually strong, generic B-roll
FALLBACK_SEARCHES = [
    "technology dark cinematic",
    "abstract dark particles",
    "futuristic neon lights",
    "cinematic clouds timelapse",
    "space stars universe",
    "city lights night aerial",
    "ocean waves dark",
    "fire flames closeup",
]


def load_props(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_props(path: str, props: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(props, f, indent=2, ensure_ascii=False)
    print(f"[OK] Props updated: {path}")


def get_total_duration_ms(captions: list[dict]) -> int:
    if not captions:
        return 0
    last = captions[-1]
    return last["startMs"] + last["durationMs"]


def find_insertion_points(captions: list[dict], num_clips: int | None = None) -> list[dict]:
    """Find insertion points based on keyword density, ~1 per 10-15s."""
    total_ms = get_total_duration_ms(captions)
    safe_start = AVOID_START_MS
    safe_end = total_ms - AVOID_END_MS
    usable_ms = safe_end - safe_start

    if usable_ms <= CLIP_DISPLAY_MS:
        print("[WARN] Video too short for any B-roll clips")
        return []

    if num_clips is None:
        num_clips = max(1, round(usable_ms / CLIP_INTERVAL_MS))
    max_possible = max(1, int(usable_ms / (CLIP_DISPLAY_MS + MIN_CLIP_SPACING_MS)))
    if num_clips > max_possible:
        print(f"[INFO] Reduced from {num_clips} to {max_possible} clips (video too short)")
        num_clips = max_possible

    print(f"[INFO] Target: {num_clips} clip(s) for {usable_ms / 1000:.0f}s usable duration")

    # Score each caption by keyword density
    scored = []
    for cap in captions:
        start = cap["startMs"]
        end = start + cap["durationMs"]
        if start < safe_start or end + CLIP_DISPLAY_MS > total_ms - AVOID_END_MS:
            continue
        keyword_count = sum(1 for t in cap.get("tokens", []) if t.get("isKeyword"))
        scored.append({"caption": cap, "score": keyword_count, "startMs": start})

    if not scored:
        scored = [
            {"caption": cap, "score": 0, "startMs": cap["startMs"]}
            for cap in captions
            if safe_start <= cap["startMs"] and cap["startMs"] + CLIP_DISPLAY_MS <= total_ms - AVOID_END_MS
        ]

    if not scored:
        return []

    zone_size = usable_ms / num_clips
    points = []
    for i in range(num_clips):
        zone_start = safe_start + i * zone_size
        zone_end = zone_start + zone_size
        candidates = [s for s in scored if zone_start <= s["startMs"] < zone_end]
        if not candidates:
            candidates = scored
        for c in sorted(candidates, key=lambda x: -x["score"]):
            too_close = any(
                abs(p["startMs"] - c["startMs"]) < MIN_CLIP_SPACING_MS
                for p in points
            )
            if not too_close:
                points.append(c)
                break

    return points


def get_nearby_captions(captions: list[dict], start_ms: int, window_ms: int = 5000) -> list[dict]:
    """Get captions within a time window around start_ms."""
    result = []
    for cap in captions:
        cap_start = cap["startMs"]
        cap_end = cap_start + cap["durationMs"]
        if cap_end >= start_ms - 500 and cap_start <= start_ms + window_ms:
            result.append(cap)
    return result


def build_search_query(caption: dict, nearby_captions: list[dict], used_queries: set[str]) -> str:
    """Build a Pexels search query — pick ONE best visual concept per clip."""
    # Collect all keyword matches from nearby captions
    matched = []
    for cap in nearby_captions:
        for token in cap.get("tokens", []):
            word = token["text"].lower()
            if word in KEYWORD_MAP:
                matched.append(KEYWORD_MAP[word])
            if token.get("isKeyword") and word in KEYWORD_MAP:
                # Keywords get priority (add twice for ranking)
                matched.append(KEYWORD_MAP[word])

    # Pick the most frequently matched concept (= most relevant)
    if matched:
        from collections import Counter
        counts = Counter(matched)
        for query, _ in counts.most_common():
            if query not in used_queries:
                return query
        # All matched queries already used — return best anyway
        return counts.most_common(1)[0][0]

    # Fallback: pick an unused fallback
    for fb in FALLBACK_SEARCHES:
        if fb not in used_queries:
            return fb
    return FALLBACK_SEARCHES[hash(caption["text"]) % len(FALLBACK_SEARCHES)]


def pexels_search(query: str, used_video_ids: set[int]) -> dict | None:
    """Search Pexels for a portrait video. Returns video info or None."""
    params = urllib.parse.urlencode({
        "query": query,
        "orientation": "portrait",
        "size": "medium",
        "per_page": 10,
    })
    url = f"{PEXELS_SEARCH_URL}?{params}"
    headers = {
        "Authorization": PEXELS_API_KEY,
        "User-Agent": "Mozilla/5.0",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[ERROR] Pexels search failed: {e}")
        return None

    videos = data.get("videos", [])
    if not videos:
        print(f"  [WARN] No portrait videos found for: {query}")
        return None

    # Pick first video that's long enough and not already used
    for video in videos:
        vid_id = video.get("id")
        duration = video.get("duration", 0)
        if vid_id in used_video_ids:
            continue
        if duration < MIN_VIDEO_DURATION_SEC:
            continue

        # Find best portrait video file (prefer HD, ~720p-1080p)
        files = video.get("video_files", [])
        best_file = None
        best_height = 0
        for vf in files:
            h = vf.get("height", 0)
            w = vf.get("width", 0)
            # Portrait: height > width
            if h > w and 720 <= h <= 1920 and vf.get("link"):
                if h > best_height:
                    best_height = h
                    best_file = vf
        # Fallback: any portrait file
        if not best_file:
            for vf in files:
                h = vf.get("height", 0)
                w = vf.get("width", 0)
                if h > w and vf.get("link"):
                    if h > best_height:
                        best_height = h
                        best_file = vf

        if best_file:
            return {
                "id": vid_id,
                "url": best_file["link"],
                "width": best_file.get("width", 0),
                "height": best_height,
                "duration": duration,
                "photographer": video.get("user", {}).get("name", "Unknown"),
            }

    print(f"  [WARN] No suitable portrait video files for: {query}")
    return None


def download_clip(url: str, filename: str) -> str | None:
    """Download video to public/ directory. Returns local filename or None."""
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    dest = os.path.join(PUBLIC_DIR, filename)
    try:
        print(f"  Downloading → {filename}")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            with open(dest, "wb") as f:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"  [OK] Downloaded ({size_mb:.1f} MB)")
        return filename
    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        return None


def generate_clip_filename(props_path: str, index: int) -> str:
    basename = os.path.splitext(os.path.basename(props_path))[0]
    return f"broll_{basename}_{index}.mp4"


def main():
    import urllib.parse  # lazy import for search params

    parser = argparse.ArgumentParser(description="Add B-roll stock footage to Shorts via Pexels")
    parser.add_argument("props_json", help="Path to props JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Show insertion points and search queries without downloading")
    parser.add_argument("--num-clips", type=int, default=None, help="Number of clips (default: auto, ~1 per 10-15s)")
    parser.add_argument("--queries", type=str, default=None, help="Comma-separated Pexels search queries (one per clip, overrides auto-detection)")
    args = parser.parse_args()

    props_path = os.path.abspath(args.props_json)
    if not os.path.exists(props_path):
        print(f"[ERROR] File not found: {props_path}")
        sys.exit(1)

    props = load_props(props_path)
    captions = props.get("captions", [])
    if not captions:
        print("[ERROR] No captions found in props")
        sys.exit(1)

    total_ms = get_total_duration_ms(captions)
    print(f"Video duration: {total_ms / 1000:.1f}s, {len(captions)} caption pages")

    # Parse explicit queries if provided
    explicit_queries = None
    if args.queries:
        explicit_queries = [q.strip() for q in args.queries.split(",") if q.strip()]

    # Find insertion points
    num_clips = args.num_clips or (len(explicit_queries) if explicit_queries else None)
    points = find_insertion_points(captions, num_clips=num_clips)
    if not points:
        print("[WARN] No suitable insertion points found")
        sys.exit(0)

    print(f"\nFound {len(points)} insertion point(s):")

    # Build search queries
    clip_tasks = []
    used_queries: set[str] = set()
    for i, point in enumerate(points):
        if explicit_queries and i < len(explicit_queries):
            query = explicit_queries[i]
        else:
            nearby = get_nearby_captions(captions, point["startMs"])
            query = build_search_query(point["caption"], nearby, used_queries)
        used_queries.add(query)
        clip_tasks.append((i, point, query))

        print(f"\n  [{i + 1}] @ {point['startMs'] / 1000:.1f}s")
        print(f"      Caption: \"{point['caption']['text']}\"")
        print(f"      Search:  \"{query}\"")

    if args.dry_run:
        print("\n[DRY RUN] No API calls made.")
        sys.exit(0)

    if PEXELS_API_KEY == "YOUR_API_KEY_HERE":
        print("\n[ERROR] Set PEXELS_API_KEY environment variable")
        sys.exit(1)

    # Search & download clips
    print(f"\n{'=' * 50}")
    print(f"Fetching {len(clip_tasks)} B-roll clip(s) from Pexels...")
    print(f"{'=' * 50}")

    ai_clips = []
    used_video_ids: set[int] = set()

    for i, point, query in clip_tasks:
        print(f"\n[Clip {i + 1}] Searching: \"{query}\"")
        video_info = pexels_search(query, used_video_ids)

        if not video_info:
            # Try fallback search
            fallback = FALLBACK_SEARCHES[i % len(FALLBACK_SEARCHES)]
            print(f"  Trying fallback: \"{fallback}\"")
            video_info = pexels_search(fallback, used_video_ids)

        if not video_info:
            print(f"  [SKIP] No video found for clip {i + 1}")
            continue

        used_video_ids.add(video_info["id"])
        print(f"  Found: {video_info['width']}x{video_info['height']}, {video_info['duration']}s (by {video_info['photographer']})")

        filename = generate_clip_filename(props_path, i)
        local_file = download_clip(video_info["url"], filename)
        if not local_file:
            continue

        ai_clips.append({
            "src": local_file,
            "startMs": point["startMs"],
            "durationMs": CLIP_DISPLAY_MS,
        })

    # Sort by startMs
    ai_clips.sort(key=lambda c: c["startMs"])

    if not ai_clips:
        print("\n[WARN] No clips downloaded successfully")
        sys.exit(0)

    # Update props JSON
    props["aiClips"] = ai_clips
    save_props(props_path, props)

    print(f"\n{'=' * 50}")
    print(f"Done! {len(ai_clips)} B-roll clip(s) added to props:")
    for clip in ai_clips:
        print(f"  - {clip['src']} @ {clip['startMs'] / 1000:.1f}s ({clip['durationMs']}ms)")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
