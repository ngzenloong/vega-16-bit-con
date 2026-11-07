export function hallAudioShouldPlay(state: {
  enabled: boolean;
  paused: boolean;
  hidden: boolean;
  focused: boolean;
  gameOpen: boolean;
}) {
  return (
    state.enabled &&
    !state.paused &&
    !state.hidden &&
    state.focused &&
    !state.gameOpen
  );
}
