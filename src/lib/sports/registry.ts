import { CHESS_DEFAULTS } from "./engines/chess";
import { CRICKET_DEFAULTS } from "./engines/cricket";
import { BADMINTON_DEFAULTS, type RallyConfig } from "./engines/rally";
import { TALLY_DEFAULTS } from "./engines/tally";
import { TENNIS_DEFAULTS } from "./engines/tennis";
import { FOOTBALL_DEFAULTS, type TimedConfig } from "./engines/timed";
import type { EngineId, SportId } from "./types";

export interface SportDef {
  id: SportId;
  name: string;
  emoji: string;
  engine: EngineId;
  /** Brand colour for tiles and accents. */
  accent: string;
  tagline: string;
  /** "team" sports can carry player rosters. */
  side: "team" | "individual";
  participantLabel: string;
  minParticipants: number;
  maxParticipants: number;
  defaults: () => Record<string, unknown>;
}

const timed = (overrides: Partial<TimedConfig>): (() => Record<string, unknown>) => () => ({
  ...structuredClone(FOOTBALL_DEFAULTS),
  ...structuredClone(overrides),
});

const rally = (overrides: Partial<RallyConfig>): (() => Record<string, unknown>) => () => ({
  ...BADMINTON_DEFAULTS,
  ...overrides,
});

export const SPORTS: SportDef[] = [
  {
    id: "cricket",
    name: "Cricket",
    emoji: "🏏",
    engine: "cricket",
    accent: "#16a34a",
    tagline: "Ball-by-ball scoring, extras, wickets & full scorecards",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: () => ({ ...CRICKET_DEFAULTS }),
  },
  {
    id: "football",
    name: "Football",
    emoji: "⚽",
    engine: "timed",
    accent: "#059669",
    tagline: "Live clock, scorers, cards, extra time & penalties",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: timed({}),
  },
  {
    id: "basketball",
    name: "Basketball",
    emoji: "🏀",
    engine: "timed",
    accent: "#ea580c",
    tagline: "1-2-3 pointers, quarters, team fouls & overtime",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: timed({
      periods: 4,
      periodMinutes: 10,
      periodName: "Quarter",
      clock: "down",
      actions: [
        { key: "ft", label: "Free throw", points: 1 },
        { key: "two", label: "2 pointer", points: 2 },
        { key: "three", label: "3 pointer", points: 3 },
      ],
      scoreNoun: "Basket",
      cards: false,
      fouls: true,
      assists: false,
      stats: [
        { key: "rebounds", label: "Rebounds" },
        { key: "timeouts", label: "Timeouts" },
      ],
      extraTime: { periods: 1, minutes: 5 },
      repeatExtraTime: true,
      shootout: false,
    }),
  },
  {
    id: "hockey",
    name: "Hockey",
    emoji: "🏑",
    engine: "timed",
    accent: "#2563eb",
    tagline: "Quarters, field goals, penalty corners & shoot-outs",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: timed({
      periods: 4,
      periodMinutes: 15,
      periodName: "Quarter",
      clock: "down",
      stats: [
        { key: "shots", label: "Shots on goal" },
        { key: "corners", label: "Penalty corners" },
      ],
      extraTime: null,
      shootout: true,
      shootoutRounds: 5,
    }),
  },
  {
    id: "kabaddi",
    name: "Kabaddi",
    emoji: "🤼",
    engine: "timed",
    accent: "#e11d48",
    tagline: "Raid, tackle, bonus & all-out points",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: timed({
      periods: 2,
      periodMinutes: 20,
      periodName: "Half",
      clock: "down",
      actions: [
        { key: "raid", label: "Raid", points: 1 },
        { key: "tackle", label: "Tackle", points: 1 },
        { key: "bonus", label: "Bonus", points: 1 },
        { key: "super_tackle", label: "Super tackle", points: 2 },
        { key: "all_out", label: "All out", points: 2 },
      ],
      scoreNoun: "Point",
      cards: true,
      assists: false,
      stats: [
        { key: "raids", label: "Raids" },
        { key: "empty_raids", label: "Empty raids" },
      ],
      extraTime: null,
      shootout: false,
    }),
  },
  {
    id: "rugby",
    name: "Rugby",
    emoji: "🏉",
    engine: "timed",
    accent: "#7c3aed",
    tagline: "Tries, conversions, penalties & drop goals",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: timed({
      periods: 2,
      periodMinutes: 40,
      periodName: "Half",
      clock: "up",
      actions: [
        { key: "try", label: "Try", points: 5 },
        { key: "conversion", label: "Conversion", points: 2 },
        { key: "penalty", label: "Penalty", points: 3 },
        { key: "drop_goal", label: "Drop goal", points: 3 },
      ],
      scoreNoun: "Score",
      cards: true,
      assists: false,
      stats: [
        { key: "lineouts", label: "Lineouts won" },
        { key: "scrums", label: "Scrums won" },
      ],
      extraTime: null,
      shootout: false,
    }),
  },
  {
    id: "tennis",
    name: "Tennis",
    emoji: "🎾",
    engine: "tennis",
    accent: "#65a30d",
    tagline: "Points, games, sets, tiebreaks & break points",
    side: "individual",
    participantLabel: "Player",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: () => ({ ...TENNIS_DEFAULTS }),
  },
  {
    id: "badminton",
    name: "Badminton",
    emoji: "🏸",
    engine: "rally",
    accent: "#0891b2",
    tagline: "Rally scoring to 21, capped at 30, best of 3",
    side: "individual",
    participantLabel: "Player",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: rally({}),
  },
  {
    id: "table_tennis",
    name: "Table Tennis",
    emoji: "🏓",
    engine: "rally",
    accent: "#dc2626",
    tagline: "Games to 11 with automatic serve rotation",
    side: "individual",
    participantLabel: "Player",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: rally({
      pointsToWin: 11,
      cap: null,
      bestOf: 5,
      serveRule: "alternate",
      alternateEvery: 2,
      nextGameServer: "alternate",
    }),
  },
  {
    id: "volleyball",
    name: "Volleyball",
    emoji: "🏐",
    engine: "rally",
    accent: "#d97706",
    tagline: "Sets to 25, deciding set to 15, best of 5",
    side: "team",
    participantLabel: "Team",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: rally({
      pointsToWin: 25,
      cap: null,
      bestOf: 5,
      decidingPoints: 15,
      serveRule: "winner",
      nextGameServer: "alternate",
      gameName: "Set",
    }),
  },
  {
    id: "chess",
    name: "Chess",
    emoji: "♟️",
    engine: "chess",
    accent: "#475569",
    tagline: "Chess clock with increment, results & multi-game matches",
    side: "individual",
    participantLabel: "Player",
    minParticipants: 2,
    maxParticipants: 2,
    defaults: () => ({ ...CHESS_DEFAULTS }),
  },
  {
    id: "custom",
    name: "Any game",
    emoji: "🎲",
    engine: "tally",
    accent: "#c026d3",
    tagline: "Board games, cards, carrom, quizzes — 2 to 12 players",
    side: "individual",
    participantLabel: "Player",
    minParticipants: 2,
    maxParticipants: 12,
    defaults: () => ({ ...TALLY_DEFAULTS }),
  },
];

const BY_ID = new Map(SPORTS.map((s) => [s.id, s]));

export function getSport(id: string): SportDef | undefined {
  return BY_ID.get(id as SportId);
}

export function sportOrDefault(id: string): SportDef {
  return getSport(id) ?? SPORTS[SPORTS.length - 1];
}

/** Merge a stored config over the sport's defaults so older matches keep working. */
export function resolveConfig(sportId: string, stored: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return { ...sportOrDefault(sportId).defaults(), ...(stored ?? {}) };
}

export const TEAM_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#ca8a04",
  "#0f172a",
  "#64748b",
  "#059669",
  "#9333ea",
];
