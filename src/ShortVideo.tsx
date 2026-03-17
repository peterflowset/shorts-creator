import { AbsoluteFill } from "remotion";
import { VideoBackground, CropMode } from "./components/VideoBackground";
import { SplitScreenBackground } from "./components/SplitScreenBackground";
import { GradientOverlay } from "./components/GradientOverlay";
import { AIClipOverlay, AIClip } from "./components/AIClipOverlay";
import { AnimatedCaptions, CaptionPage } from "./components/AnimatedCaptions";
import { TitleCard } from "./components/TitleCard";
import { ProgressBar } from "./components/ProgressBar";
// import { OutroCard } from "./components/OutroCard";
// import { AutoOverlays, Overlay } from "./components/AutoOverlays";

export type LayoutMode = "single" | "split" | "slide";

export type CaptionPosition = "top" | "center" | "bottom";

export interface ShortVideoProps extends Record<string, unknown> {
  videoSrc: string;
  captions: CaptionPage[];
  hookText: string;
  hookDurationFrames?: number;
  layout?: LayoutMode;
  cropMode?: CropMode;
  splitTopPercent?: number;
  splitBottomPercent?: number;
  aiClips?: AIClip[];
  overlays?: unknown[];
  ctaText?: string;
  outroDurationFrames?: number;
  captionOffsetMs?: number;
  captionPosition?: CaptionPosition;
}

export const ShortVideo = ({
  videoSrc,
  captions,
  hookText,
  hookDurationFrames = 90,
  layout = "single",
  cropMode = "center",
  splitTopPercent = 25,
  splitBottomPercent = 75,
  aiClips = [],
  overlays = [],
  ctaText,
  outroDurationFrames = 75,
  captionOffsetMs,
  captionPosition = "bottom",
}: ShortVideoProps) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {layout === "split" ? (
        <SplitScreenBackground
          videoSrc={videoSrc}
          topCropPercent={splitTopPercent}
          bottomCropPercent={splitBottomPercent}
        />
      ) : layout === "slide" ? (
        <VideoBackground videoSrc={videoSrc} cropMode="full" />
      ) : (
        <VideoBackground videoSrc={videoSrc} cropMode={cropMode} />
      )}
      <AIClipOverlay clips={aiClips} />
      <GradientOverlay />
      <ProgressBar />
      <AnimatedCaptions pages={captions} captionOffsetMs={captionOffsetMs} captionPosition={captionPosition} />
      <TitleCard hookText={hookText} durationFrames={hookDurationFrames} captionPosition={captionPosition} />
    </AbsoluteFill>
  );
};
