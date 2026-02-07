import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770463123334.png";

interface VortexLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizePx = {
  sm: 40,
  md: 80,
  lg: 144,
  xl: 200,
};

export function VortexLogo({ size = "sm", className = "" }: VortexLogoProps) {
  const px = sizePx[size];

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        flexShrink: 0,
      }}
      data-testid="vibra-logo"
    >
      <img
        src={vibraLogo}
        alt="Vibra"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}
