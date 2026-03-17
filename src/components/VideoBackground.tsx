import {
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

export type CropMode =
  | "center" // Default: center crop to 9:16
  | "left" // Crop left third (left speaker)
  | "right" // Crop right third (right speaker)
  | "full"; // Full frame with letterbox (slides/presentations)

interface VideoBackgroundProps {
  videoSrc: string;
  cropMode?: CropMode;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  videoSrc,
  cropMode = "center",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow zoom (Ken Burns) - very subtle to avoid over-zoom on webcam crops
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.02], {
    extrapolateRight: "clamp",
  });

  if (cropMode === "full") {
    // Letterbox: show full width, black bars top/bottom
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={staticFile(videoSrc)}
          style={{
            width: "100%",
            transform: `scale(${scale})`,
            objectFit: "contain",
          }}
        />
      </div>
    );
  }

  // Determine horizontal position for crop
  let objectPosition = "center center";
  if (cropMode === "left") objectPosition = "25% center";
  if (cropMode === "right") objectPosition = "75% center";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <OffthreadVideo
        src={staticFile(videoSrc)}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          minWidth: "100%",
          minHeight: "100%",
          objectFit: "cover",
          objectPosition,
        }}
      />
    </div>
  );
};
