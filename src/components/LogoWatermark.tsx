import { Img, staticFile, useCurrentFrame, interpolate } from "remotion";

interface LogoWatermarkProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export const LogoWatermark: React.FC<LogoWatermarkProps> = ({
  position = "top-right",
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 0.85], {
    extrapolateRight: "clamp",
  });

  const posStyle: React.CSSProperties = {
    position: "absolute",
    padding: "40px",
    zIndex: 10,
  };

  if (position.includes("top")) posStyle.top = 0;
  if (position.includes("bottom")) posStyle.bottom = 0;
  if (position.includes("left")) posStyle.left = 0;
  if (position.includes("right")) posStyle.right = 0;

  return (
    <div style={posStyle}>
      <Img
        src={staticFile("logo-everlast.png")}
        style={{
          height: 40,
          opacity,
          filter: "brightness(10)",
        }}
      />
    </div>
  );
};
