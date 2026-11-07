import type { CSSProperties } from "react";
type Name = "close" | "pause" | "sound" | "muted" | "play" | "loading";
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: Name;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "pause" && <path d="M8 5v14M16 5v14" />}
      {name === "play" && <path d="m8 5 11 7-11 7Z" />}
      {name === "loading" && (
        <path
          d="M4 11h2v2H4zM11 11h2v2h-2zM18 11h2v2h-2z"
          fill="currentColor"
          stroke="none"
        />
      )}
      {(name === "sound" || name === "muted") && (
        <>
          <path d="M3 9h4l5-4v14l-5-4H3z" />
          {name === "sound" ? (
            <path d="M16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16" />
          ) : (
            <path d="m16 9 6 6m0-6-6 6" />
          )}
        </>
      )}
    </svg>
  );
}
