import type { ReactNode } from "react";

/** The same quiet frame used for information windows on Vega's site. */
export default function InfoWindow({
  title,
  children,
  className = "",
  platform = false,
  labelledBy,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  platform?: boolean;
  labelledBy?: string;
}) {
  return (
    <section
      className={`info-window ${className}`}
      data-platform={platform || undefined}
      aria-labelledby={labelledBy}
    >
      <div className="info-titlebar">
        <span className="info-caption">{title}</span>
        <span className="window-marks" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <img
              key={index}
              src="/assets/vega/window-mark.svg"
              alt=""
              width={18}
              height={18}
            />
          ))}
        </span>
      </div>
      <div className="info-window-body">{children}</div>
    </section>
  );
}
