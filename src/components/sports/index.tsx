"use client";

import type { ComponentType } from "react";
import type { EngineId } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { ChessBoardView, ChessScorer } from "./chess";
import { CricketBoard, CricketScorer } from "./cricket";
import { RallyBoard, RallyScorer, TennisBoard, TennisScorer } from "./racket";
import { TallyBoard, TallyScorer } from "./tally";
import { TimedBoard, TimedScorer } from "./timed";

type View = ComponentType<{ sync: MatchSync }>;

export const SPORT_VIEWS: Record<EngineId, { Scorer: View; Board: View }> = {
  cricket: { Scorer: CricketScorer, Board: CricketBoard },
  timed: { Scorer: TimedScorer, Board: TimedBoard },
  rally: { Scorer: RallyScorer, Board: RallyBoard },
  tennis: { Scorer: TennisScorer, Board: TennisBoard },
  chess: { Scorer: ChessScorer, Board: ChessBoardView },
  tally: { Scorer: TallyScorer, Board: TallyBoard },
};
