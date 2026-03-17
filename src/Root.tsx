import { Composition } from "remotion";
import { ShortVideo } from "./ShortVideo";
import type { ShortVideoProps } from "./ShortVideo";

const defaultProps: ShortVideoProps = {
  videoSrc: "sample.mp4",
  captions: [
    {
      text: "Das ist ein Beispiel",
      startMs: 0,
      durationMs: 3000,
      tokens: [
        { text: "Das", fromMs: 0, toMs: 500 },
        { text: "ist", fromMs: 500, toMs: 800 },
        { text: "ein", fromMs: 800, toMs: 1200 },
        { text: "Beispiel", fromMs: 1200, toMs: 2000 },
      ],
    },
    {
      text: "fuer animierte Untertitel",
      startMs: 3000,
      durationMs: 3000,
      tokens: [
        { text: "fuer", fromMs: 3000, toMs: 3500 },
        { text: "animierte", fromMs: 3500, toMs: 4200 },
        { text: "Untertitel", fromMs: 4200, toMs: 5500 },
      ],
    },
  ],
  hookText: "Das musst du sehen!",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          // Calculate duration from last caption timestamp
          // 1500ms buffer after last word: Whisper toMs is often slightly early,
          // so we need room for the word to finish + natural breathing pause
          const lastCaption = props.captions[props.captions.length - 1];
          const lastMs = lastCaption
            ? lastCaption.startMs + lastCaption.durationMs + 1500
            : 45000;
          const contentFrames = Math.ceil((lastMs / 1000) * 30);
          return {
            durationInFrames: contentFrames,
          };
        }}
      />
    </>
  );
};
