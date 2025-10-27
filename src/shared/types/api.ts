// Reddit Realm Quiz Wars - Shared API Types

export interface Question {
  question: string;
  options: string[];
  correct: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  source?: string;
  sourceType?: 'reddit-post' | 'gemini-ai' | 'fallback' | 'content-discovery';
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  battlesWon: number;
  battlesLost: number;
  realm: string;
}

export interface GameResult {
  player: string;
  realm: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: string;
  playerWon: boolean;
  opponentScore: number;
}

export interface Challenge {
  id: string;
  challengerId: string;
  challengedId: string;
  realm: string;
  type: 'duel' | 'champion';
  stakes?: {
    points: number;
    realmHonor?: number;
  };
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// API Response Types
export type InitResponse = {
  type: "init";
  postId: string;
  realm: string;
  username: string;
  questions: Question[];
  leaderboard: LeaderboardEntry[];
  playerStats?: {
    score: number;
    battlesWon: number;
    battlesLost: number;
  };
};

export type GameStateResponse = {
  type: "game_state";
  gameId: string;
  currentQuestion?: Question;
  questionIndex: number;
  totalQuestions: number;
  score: number;
  timeRemaining: number;
  gameStatus: 'waiting' | 'active' | 'completed' | 'forfeited';
};

export type QuestionResponse = {
  type: "question";
  question: Question;
  questionIndex: number;
  totalQuestions: number;
};

export type GameCompleteResponse = {
  type: "game_complete";
  finalScore: number;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  newRank?: number;
  pointsEarned: number;
};

export type LeaderboardResponse = {
  type: "leaderboard";
  realm: string;
  leaderboard: LeaderboardEntry[];
  playerRank?: number;
};

export type ChallengeResponse = {
  type: "challenge";
  challenge: Challenge;
  success: boolean;
  message: string;
};

export type ErrorResponse = {
  type: "error";
  message: string;
  code?: string;
};