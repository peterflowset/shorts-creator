import {
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";

export interface AIClip {
  src: string;
  startMs: number;
  durationMs: number;
}

interface AIClipOverlayProps {
  clips: AIClip[];
}

const FADE_IN_MS = 300;
const FADE_OUT_MS = 500;

const AIClipItem: React.FC<{ clip: AIClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const clipDurationMs = clip.durationMs;
  const currentMs = (frame / fps) * 1000;

  const opacity = interpolate(
    currentMs,
    [0, FADE_IN_MS, clipDurationMs - FADE_OUT_MS, clipDurationMs],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        zIndex: 0,
      }}
    >
      <Video
        src={staticFile(clip.src)}
        startFrom={0}
        volume={0}
        playbackRate={1}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};

export const AIClipOverlay: React.FC<AIClipOverlayProps> = ({ clips }) => {
  const { fps } = useVideoConfig();

  if (!clips || clips.length === 0) return null;

  return (
    <>
      {clips.map((clip, i) => {
        const startFrame = Math.round((clip.startMs / 1000) * fps);
        const durationFrames = Math.round((clip.durationMs / 1000) * fps);

        return (
          <Sequence
            key={`ai-clip-${i}`}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <AIClipItem clip={clip} />
          </Sequence>
        );
      })}
    </>
  );
};
