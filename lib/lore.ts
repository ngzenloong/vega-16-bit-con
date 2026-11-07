export type LoreAction =
  | "register"
  | "schedule"
  | "explore"
  | "about"
  | "close"
  | "find-breaker"
  | "find-runner"
  | "find-kart"
  | "find-beat";
export type LoreCharacter = {
  id: string;
  name: string;
  role: string;
  lines: string[];
  choices?: { label: string; action: LoreAction }[];
  sourceUrl?: string;
};

// Characters and the Legacy Stack rivalry are fiction. SIEM is a technology category.
// Company statements below are grounded in the linked Vega sources, not employee quotations.
export const CHARACTERS: LoreCharacter[] = [
  {
    id: "host",
    name: "Patch",
    role: "Vega crew · Host",
    lines: [
      "Welcome to Booth 630. I'm Patch from the Vega crew.",
      "Vega has home bases in New York and Tel Aviv. Today, we're taking over this arcade.",
      "All four games are open. Make a player at the desk if you want your own name and look.",
    ],
    choices: [
      { label: "Make my Sam", action: "register" },
      { label: "See the schedule", action: "schedule" },
      { label: "Explore the floor", action: "explore" },
    ],
    sourceUrl: "https://vega.io/careers",
  },
  {
    id: "collector",
    name: "Pip",
    role: "Cartridge collector",
    lines: [
      "The cartridges are organized. The bag is another story.",
      "Cartridge Run is on the Mega Drive. Visit five sources, grab their query cartridges, then head for Booth 630.",
      "The sources stay put. Even I know better than to move the whole archive.",
    ],
    choices: [
      { label: "Play Cartridge Run", action: "find-runner" },
      { label: "Nice collection", action: "close" },
    ],
  },
  {
    id: "racer",
    name: "Dash",
    role: "Circuit racer",
    lines: [
      "That yellow Fiat? PostSIEM.com on the back. Extremely subtle branding.",
      "The Legacy Stack cars are quick on a straight. Brake before the bends and use the yellow boost strips.",
      "I've been practicing. The corners are still winning.",
    ],
    choices: [
      { label: "Play Sam Circuit", action: "find-kart" },
      { label: "Keep practicing", action: "close" },
    ],
  },
  {
    id: "artist",
    name: "Mica",
    role: "Pixel artist",
    lines: [
      "I'm choosing colors for Sam before I try the Mega-CD rhythm game.",
      "Press the matching direction when its moving arrow lines up with the target.",
      "Perfect is Post-SIEM. Button mashing is a very expensive legacy strategy.",
    ],
    choices: [
      { label: "Play Sam's Beat", action: "find-beat" },
      { label: "Change my outfit", action: "register" },
    ],
  },
  {
    id: "analyst",
    name: "Rowan",
    role: "Vega crew · Analyst",
    lines: [
      "SIEM means Security Information and Event Management.",
      "Vega's analytics can query sources in place, including existing SIEMs. The data doesn't have to move first.",
      "Our arcade villain is the fictional Legacy Stack: silos, copying and waiting. Actual security teams are the good guys.",
    ],
    choices: [
      { label: "More about Vega", action: "about" },
      { label: "Back to the floor", action: "close" },
    ],
    sourceUrl: "https://vega.io/solutions/legacy-siem-augmentation",
  },
  {
    id: "coffee",
    name: "Bea",
    role: "Coffee guest",
    lines: [
      "People keep asking where the coffee is. Apparently this cup looks official.",
      "Daisy Breaker is next for me. Use the edge of the paddle to send the ball sideways.",
      "No coins needed. All four games are free to play.",
    ],
    choices: [
      { label: "Play Daisy Breaker", action: "find-breaker" },
      { label: "Enjoy your coffee", action: "close" },
    ],
  },
  {
    id: "pingpong_jules",
    name: "Jules",
    role: "Ping-pong player · Kit's opponent",
    lines: [
      "Kit calls that spin. I call it a request for a larger table.",
      "We've paused the match so you can get past. Go try a machine; we'll still be here.",
    ],
    choices: [
      { label: "Explore the floor", action: "explore" },
      { label: "Carry on", action: "close" },
    ],
  },
  {
    id: "pingpong_kit",
    name: "Kit",
    role: "Ping-pong player · Jules's opponent",
    lines: [
      "Have you seen a tiny white ball? We have been looking everywhere.",
      "Oh. Under my foot.",
    ],
    choices: [{ label: "I saw nothing", action: "close" }],
  },
  {
    id: "chess_nico",
    name: "Nico",
    role: "Chess player · Ren's opponent",
    lines: [
      "Ren is still deciding. It was supposed to be a quick game.",
      "The schedule is in the middle of this floor if you are heading that way.",
    ],
    choices: [
      { label: "See the schedule", action: "schedule" },
      { label: "Good luck, Nico", action: "close" },
    ],
  },
  {
    id: "chess_ren",
    name: "Ren",
    role: "Chess player · Nico's opponent",
    lines: [
      "I am still thinking about that bishop.",
      "Go enjoy the floor. I'll be here when you get back.",
    ],
    choices: [{ label: "I'll give you a minute", action: "close" }],
  },
];
export const AMBIENT_CONVERSATIONS: {
  speakers: [string, string];
  lines: [string, string];
}[] = [
  {
    speakers: ["host", "coffee"],
    lines: ["Found the coffee?", "Yes. Daisy Breaker is next."],
  },
  {
    speakers: ["collector", "artist"],
    lines: [
      "Is that cartridge limited edition?",
      "It is now. I drew on the box.",
    ],
  },
  {
    speakers: ["racer", "coffee"],
    lines: ["Have you tried Sam Circuit?", "Not yet. Daisy Breaker first."],
  },
  {
    speakers: ["pingpong_jules", "pingpong_kit"],
    lines: ["That was the table edge.", "Excellent. The table gets a point."],
  },
  {
    speakers: ["chess_nico", "chess_ren"],
    lines: ["Your move.", "Give me a moment."],
  },
  {
    speakers: ["artist", "coffee"],
    lines: [
      "What do you think of this color?",
      "Try it with different glasses.",
    ],
  },
];
export const LORE_SOURCES = [
  {
    id: "vega-careers",
    title: "Vega Careers",
    url: "https://vega.io/careers",
    note: "New York and Tel Aviv locations. Characters and event dialogue are fictional.",
  },
  {
    id: "vega-federated-analytics",
    title: "AI-Native Federated Analytics",
    url: "https://vega.io/technology/ai-native-federated-analytics",
    note: "Security analytics across data sources in place.",
  },
  {
    id: "vega-legacy-siem",
    title: "Legacy SIEM Augmentation",
    url: "https://vega.io/solutions/legacy-siem-augmentation",
    note: "Existing SIEM systems can remain part of the connected environment.",
  },
  {
    id: "vega-post-siem",
    title: "Vega Events",
    url: "https://vega.io/events",
    note: "Official Post-SIEM campaign positioning; not a claim that SIEM is one company.",
  },
  {
    id: "nist-siem",
    title: "Security Information and Event Management",
    url: "https://csrc.nist.gov/glossary/term/Security_Information_and_Event_Management",
    note: "Technical expansion of the acronym.",
  },
];
