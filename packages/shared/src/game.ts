export const sports = ['Basketball', 'Football', 'Volleyball', 'Tennis'] as const;
export type Sport = (typeof sports)[number];
export type MatchStatus = 'lobby' | 'live' | 'completed' | 'cancelled';
export type TeamSide = 'orange' | 'blue';

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
  city: string;
  banned: boolean;
  createdAt: string;
}
export interface Member {
  userId: string;
  name: string;
  side: TeamSide;
  captain: boolean;
}
export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}
export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sports: Sport[];
  image: string;
  rating: number | null;
  reviewCount: number;
  description: string;
  active: boolean;
  matches: MatchSummary[];
}
export interface TennisState {
  points: [number, number];
  games: [number, number];
  sets: [number, number];
  tiebreak: boolean;
}
export interface MatchSummary {
  id: string;
  title: string;
  sport: Sport;
  startsAt: string;
  status: MatchStatus;
  venueId: string;
  venueName: string;
  image: string;
  capacity: number;
  memberCount: number;
  hostId: string;
  orangeName: string;
  blueName: string;
  orangeScore: number;
  blueScore: number;
  durationMinutes: number;
  elapsedMs: number;
  clockStartedAt: string | null;
  period: number;
  code: string;
}
export interface Match extends MatchSummary {
  members: Member[];
  messages: ChatMessage[];
  version: number;
  serverTime: string;
  tennis: TennisState;
  completedAt: string | null;
  serverOffset?: number;
}
export interface Profile {
  user: Person;
  played: number;
  won: number;
  favoriteSport: string;
  topVenue: string;
  streak: number;
  venuesVisited: number;
  matches: MatchSummary[];
}

export const emptyTennis = (): TennisState => ({
  points: [0, 0],
  games: [0, 0],
  sets: [0, 0],
  tiebreak: false,
});
export function tennisPoint(input: TennisState, side: TeamSide): TennisState {
  const state = structuredClone(input);
  const i = side === 'orange' ? 0 : 1;
  const j = i === 0 ? 1 : 0;
  state.points[i]++;
  const required = state.tiebreak ? 7 : 4;
  if (state.points[i] >= required && state.points[i] - state.points[j] >= 2) {
    state.points = [0, 0];
    state.games[i]++;
    if ((state.games[i] >= 6 && state.games[i] - state.games[j] >= 2) || state.tiebreak) {
      state.sets[i]++;
      state.games = [0, 0];
      state.tiebreak = false;
    } else if (state.games[0] === 6 && state.games[1] === 6) state.tiebreak = true;
  }
  return state;
}
export function tennisLabel(state: TennisState, side: TeamSide): string {
  const i = side === 'orange' ? 0 : 1;
  const j = i === 0 ? 1 : 0;
  if (state.tiebreak) return String(state.points[i]);
  if (state.points[0] >= 3 && state.points[1] >= 3)
    return state.points[i] > state.points[j]
      ? 'AD'
      : state.points[i] < state.points[j]
        ? '40'
        : '40';
  return ['0', '15', '30', '40'][state.points[i]] ?? '40';
}
export function elapsed(
  match: Pick<MatchSummary, 'elapsedMs' | 'clockStartedAt'>,
  now = Date.now(),
): number {
  return (
    match.elapsedMs +
    (match.clockStartedAt ? Math.max(0, now - Date.parse(match.clockStartedAt)) : 0)
  );
}

export type { CreateMatchInput, VenueInput } from './validation';
