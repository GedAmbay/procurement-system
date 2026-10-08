interface LoaderWaveProps {
  /** Optional caption shown under the dots */
  label?: string;
  /** "inline" = compact (tables/cards), "page" = fills the content area */
  variant?: "inline" | "page";
  /** Dot diameter in px (default 20) */
  size?: number;
}

/**
 * Neumorphic "press wave" loader — three dots that sink in and pop out in sequence.
 */
export default function LoaderWave({ label = "Loading...", variant = "inline", size }: LoaderWaveProps) {
  return (
    <div
      className={`loader-wave-wrap ${variant === "page" ? "loader-wave-page" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="loader-wave"
        style={size ? ({ "--loader-size": `${size}px` } as React.CSSProperties) : undefined}
      >
        <span />
        <span />
        <span />
      </div>
      {label && <p className="loader-wave-label">{label}</p>}
    </div>
  );
}
