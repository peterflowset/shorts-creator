export const GradientOverlay: React.FC = () => {
  return (
    <>
      {/* Bottom gradient for caption readability */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "45%",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
          zIndex: 1,
        }}
      />
    </>
  );
};
