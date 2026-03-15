export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  score: number;
  color: string;
  isIt: boolean;
};

export type GameState = {
  phase: 'waiting' | 'playing' | 'finished';
  players: Record<string, Player>;
};
