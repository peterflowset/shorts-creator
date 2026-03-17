import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";

interface OutroCardProps {
  ctaText: string;
  durationFrames?: number;
}

const EVERLAST_YELLOW = "#FFEB00";

export const OutroCard: React.FC<OutroCardProps> = ({
  ctaText,
  durationFrames = 75,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const outroStart = durationInFrames - durationFrames;

  // Only render during outro section
  if (frame < outroStart) return null;

  const localFrame = frame - outroStart;

  const fadeIn = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const logoScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
    delay: 5,
  });

  const textEntrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
    delay: 12,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 50,
        background: `rgba(0, 0, 0, ${0.7 * fadeIn})`,
        backdropFilter: `blur(${20 * fadeIn}px)`,
      }}
    >
      {/* Everlast Logo */}
      <Img
        src={staticFile("logo-everlast.png")}
        style={{
          height: 80,
          opacity: fadeIn,
          transform: `scale(${logoScale})`,
          filter: "brightness(10)",
        }}
      />

      {/* CTA Text */}
      <p
        style={{
          fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
          fontWeight: 800,
          fontSize: 44,
          color: "#FFFFFF",
          textAlign: "center",
          lineHeight: 1.4,
          margin: 0,
          padding: "0 80px",
          opacity: textEntrance,
          transform: `translateY(${interpolate(textEntrance, [0, 1], [20, 0])}px)`,
          textShadow: "0 2px 10px rgba(0,0,0,0.6)",
        }}
      >
        {ctaText}
      </p>

      {/* Yellow accent line */}
      <div
        style={{
          width: 120,
          height: 4,
          backgroundColor: EVERLAST_YELLOW,
          opacity: textEntrance,
          transform: `scaleX(${textEntrance})`,
        }}
      />
    </div>
  );
};
