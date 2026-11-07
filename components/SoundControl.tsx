import Icon from "./Icon";

export default function SoundControl({
  enabled,
  loading,
  error,
  onToggle,
}: {
  enabled: boolean;
  loading: boolean;
  error: string;
  onToggle: () => Promise<void>;
}) {
  return (
    <>
      <button
        className="icon-button sound-toggle"
        onClick={() => void onToggle()}
        aria-label={
          loading
            ? "Cancel sound loading"
            : error && !enabled
              ? "Retry music and sound effects"
              : enabled
                ? "Mute music and sound effects"
                : "Enable music and sound effects"
        }
        aria-busy={loading}
        aria-pressed={enabled}
        title={error || "Music and sound effects (M)"}
      >
        <Icon name={loading ? "loading" : enabled ? "sound" : "muted"} />
        {error && (
          <span className="sound-error-mark" aria-hidden="true">
            !
          </span>
        )}
      </button>
      {error && (
        <span className="sr-only" role="status">
          {error}
        </span>
      )}
    </>
  );
}
