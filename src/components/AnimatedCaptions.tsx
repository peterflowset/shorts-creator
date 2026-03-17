import { useCurrentFrame, useVideoConfig } from "remotion";

export interface CaptionWord {
  text: string;
  fromMs: number;
  toMs: number;
  isKeyword?: boolean;
}

export interface CaptionPage {
  text: string;
  startMs: number;
  durationMs: number;
  tokens: CaptionWord[];
}

export type CaptionPosition = "top" | "center" | "bottom";

interface AnimatedCaptionsProps {
  pages: CaptionPage[];
  captionOffsetMs?: number;
  captionPosition?: CaptionPosition;
}

const BASE_FONT_SIZE = 62;
const MIN_FONT_SIZE = 42;
const MAX_LINE_CHARS = 20;

/** Flatten all pages into a single token timeline */
function buildTimeline(pages: CaptionPage[]): CaptionWord[] {
  const timeline: CaptionWord[] = [];
  for (const page of pages) {
    for (const token of page.tokens) {
      timeline.push({ ...token });
    }
  }
  return timeline;
}

/** Scale font so text fits on one line */
function getFontSize(text: string): number {
  if (text.length <= MAX_LINE_CHARS) return BASE_FONT_SIZE;
  return Math.max(
    MIN_FONT_SIZE,
    Math.floor(BASE_FONT_SIZE * (MAX_LINE_CHARS / text.length)),
  );
}

/** Map captionPosition to CSS alignment */
function getPositionStyles(pos: CaptionPosition): React.CSSProperties {
  switch (pos) {
    case "top":
      return { alignItems: "flex-start", paddingTop: 180 };
    case "bottom":
      return { alignItems: "flex-end", paddingBottom: 200 };
    case "center":
    default:
      return { alignItems: "center" };
  }
}

export const AnimatedCaptions: React.FC<AnimatedCaptionsProps> = ({
  pages,
  captionOffsetMs = 0,
  captionPosition = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const SYNC_DELAY_MS = 150;
  const currentTimeMs = (frame / fps) * 1000 - captionOffsetMs - SYNC_DELAY_MS;

  const timeline = buildTimeline(pages);
  if (timeline.length === 0) return null;

  // Find the word currently being spoken
  let currentIndex = -1;
  for (let i = 0; i < timeline.length; i++) {
    if (currentTimeMs >= timeline[i].fromMs && currentTimeMs < timeline[i].toMs) {
      currentIndex = i;
      break;
    }
  }

  // In a pause: show the last spoken word
  if (currentIndex < 0) {
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (currentTimeMs >= timeline[i].toMs) {
        currentIndex = i;
        break;
      }
    }
  }

  if (currentIndex < 0) return null;

  const lastToken = timeline[timeline.length - 1];
  if (currentTimeMs > lastToken.toMs + 500) return null;

  // Sliding window: show current + previous word (max 2)
  const visibleTokens: CaptionWord[] = [];
  if (currentIndex > 0) {
    visibleTokens.push(timeline[currentIndex - 1]);
  }
  visibleTokens.push(timeline[currentIndex]);

  const displayText = visibleTokens.map((t) => t.text).join(" ");
  const fontSize = getFontSize(displayText);

  const posStyles = getPositionStyles(captionPosition);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        ...posStyles,
        padding: posStyles.paddingTop ? `${posStyles.paddingTop}px 50px 0` : posStyles.paddingBottom ? `0 50px ${posStyles.paddingBottom}px` : "0 50px",
        zIndex: 3,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontWeight: 700,
          fontSize,
          color: "#FFFFFF",
          whiteSpace: "nowrap",
          WebkitTextStroke: "2px rgba(0, 0, 0, 0.9)",
          paintOrder: "stroke fill",
          textShadow:
            "0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)",
          lineHeight: 1.3,
          letterSpacing: "-0.01em",
        }}
      >
        {visibleTokens.map((token, i) => {
          return (
            <span
              key={`${token.text}-${token.fromMs}`}
            >
              {i > 0 ? " " : ""}
              {token.text}
            </span>
          );
        })}
      </span>
    </div>
  );
};
