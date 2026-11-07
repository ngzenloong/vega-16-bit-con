import test from "node:test";
import assert from "node:assert/strict";
import { hallAudioShouldPlay } from "../lib/ambience.ts";

test("a late music load cannot restart the hall while blurred, hidden, paused or inside a game", () => {
  const state = {
    enabled: true,
    paused: false,
    hidden: false,
    focused: true,
    gameOpen: false,
  };
  assert.equal(hallAudioShouldPlay(state), true);
  for (const change of [
    { enabled: false },
    { paused: true },
    { hidden: true },
    { focused: false },
    { gameOpen: true },
  ])
    assert.equal(hallAudioShouldPlay({ ...state, ...change }), false);
  assert.equal(
    hallAudioShouldPlay({ ...state, paused: true, focused: true }),
    false,
    "returning focus must not clear the user's pause preference",
  );
});
