import {
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

interface SplitScreenBackgroundProps {
  videoSrc: string;
  topCropPercent?: number; // X position % for top crop (default 25 = left speaker)
  bottomCropPercent?: number; // X position % for bottom crop (default 75 = right speaker)
  splitRatio?: number; // 0-1, how much space the top gets (default 0.5)
}

export const SplitScreenBackground: React.FC<SplitScreenBackgroundProps> = ({
  videoSrc,
  topCropPercent = 25,
  bottomCropPercent = 75,
  splitRatio = 0.5,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.04], {
    extrapolateRight: "clamp",
  });

  const topHeight = `${splitRatio * 100}%`;
  const bottomHeight = `${(1 - splitRatio) * 100}%`;
  const src = staticFile(videoSrc);

  const dividerHeight = 4;

  // Map cropPercent to a left offset for the 200%-wide video
  // 25% (left person) → left: 0% (show left half)
  // 75% (right person) → left: -100% (show right half)
  // 50% (center) → left: -50%
  const topLeft = `${-(topCropPercent * 2 - 50)}%`;
  const bottomLeft = `${-(bottomCropPercent * 2 - 50)}%`;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      {/* Top speaker */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: topHeight,
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={src}
          style={{
            position: "absolute",
            top: 0,
            left: topLeft,
            width: "200%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>

      {/* Divider removed for cleaner look */}

      {/* Bottom speaker */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: bottomHeight,
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={src}
          style={{
            position: "absolute",
            top: 0,
            left: bottomLeft,
            width: "200%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
};
