import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

type CaptionPosition = "top" | "center" | "bottom";

interface TitleCardProps {
  hookText: string;
  durationFrames?: number;
  captionPosition?: CaptionPosition;
}

/** Position hook BELOW the caption area */
function getHookPosition(captionPosition: CaptionPosition): React.CSSProperties {
  switch (captionPosition) {
    case "top":
      // Caption is at top (~180px) → hook below at ~280px
      return { top: 280 };
    case "center":
      // Caption is centered → hook below center
      return { top: "58%" };
    case "bottom":
    default:
      // Caption is at bottom (~200px from bottom) → hook above caption area
      // Hook goes above the caption, so closer to center
      return { bottom: 300 };
  }
}

export const TitleCard: React.FC<TitleCardProps> = ({
  hookText,
  durationFrames = 120,
  captionPosition = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame >= durationFrames) return null;

  // Slide in from below with spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 100 },
    delay: 5,
  });

  // Fade out last 15 frames
  const fadeOut = interpolate(
    frame,
    [durationFrames - 15, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        position: "absolute",
        ...getHookPosition(captionPosition),
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "20px 50px 0",
        zIndex: 5,
        opacity: fadeOut,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          borderRadius: 16,
          padding: "18px 32px",
          maxWidth: 700,
        }}
      >
        <p
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontWeight: 800,
            fontSize: 48,
            color: "#1a1a1a",
            textAlign: "center",
            lineHeight: 1.3,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {hookText}
        </p>
      </div>
    </div>
  );
};
