import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

const EVERLAST_YELLOW = "#FFEB00";

export interface Overlay {
  type: "stat" | "cta";
  /** Stat text or CTA text */
  text: string;
  /** When to show (ms from segment start) */
  startMs: number;
  /** How long to show (ms) */
  durationMs?: number;
}

interface AutoOverlaysProps {
  overlays: Overlay[];
  captionOffsetMs?: number;
}

const StatOverlay: React.FC<{
  text: string;
  localFrame: number;
  durationFrames: number;
  fps: number;
}> = ({ text, localFrame, durationFrames, fps }) => {
  const entrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const exit = interpolate(
    localFrame,
    [durationFrames - 10, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "20%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 8,
        opacity: entrance * exit,
        transform: `scale(${interpolate(entrance, [0, 1], [0.5, 1])})`,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(12px)",
          borderRadius: 16,
          padding: "16px 36px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: `2px solid ${EVERLAST_YELLOW}40`,
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontWeight: 900,
            fontSize: 64,
            color: EVERLAST_YELLOW,
            letterSpacing: "-0.02em",
            textShadow: `0 0 30px ${EVERLAST_YELLOW}80`,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

const CtaOverlay: React.FC<{
  text: string;
  localFrame: number;
  durationFrames: number;
  fps: number;
}> = ({ text, localFrame, durationFrames, fps }) => {
  const entrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const exit = interpolate(
    localFrame,
    [durationFrames - 12, durationFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const slideY = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "38%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 8,
        opacity: entrance * exit,
        transform: `translateY(${slideY}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(10px)",
          borderRadius: 30,
          padding: "10px 28px",
          border: `1.5px solid rgba(255, 255, 255, 0.2)`,
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
            fontWeight: 700,
            fontSize: 28,
            color: "#FFFFFF",
            letterSpacing: "0.02em",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

export const AutoOverlays: React.FC<AutoOverlaysProps> = ({
  overlays,
  captionOffsetMs = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000 - captionOffsetMs;

  return (
    <>
      {overlays.map((overlay, i) => {
        const durationMs = overlay.durationMs ?? 1500;
        const endMs = overlay.startMs + durationMs;

        if (currentTimeMs < overlay.startMs || currentTimeMs >= endMs) {
          return null;
        }

        const localFrame = ((currentTimeMs - overlay.startMs) / 1000) * fps;
        const durationFrames = (durationMs / 1000) * fps;

        const props = {
          text: overlay.text,
          localFrame,
          durationFrames,
          fps,
        };

        switch (overlay.type) {
          case "stat":
            return <StatOverlay key={i} {...props} />;
          case "cta":
            return <CtaOverlay key={i} {...props} />;
          default:
            return null;
        }
      })}
    </>
  );
};
