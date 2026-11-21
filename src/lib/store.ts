import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Game } from "./morris";
import type { Match, Room } from "./rooms";

type State = {
  session: Session | null;
  room: Room | null;
  selected: number | null;
  optimistic: { code: string; version: number; game: Game; deadline: string | null } | null;
  previewMove: (optimistic: State["optimistic"]) => void;
  joinCode: string;
  wins: number;
  matches: Match[];
  setSession: (session: Session | null) => void;
  openRoom: (room: Room) => void;
  syncRoom: (room: Room) => void;
  exit: () => void;
  select: (selected: number | null) => void;
  setJoinCode: (joinCode: string) => void;
  setHistory: (wins: number, matches: Match[]) => void;
};

export const useMorris = create<State>((set) => ({
  session: null, room: null, selected: null, optimistic: null, joinCode: "", wins: 0, matches: [],
  setSession: (session) => set((state) => session?.user.id === state.session?.user.id
    ? { session }
    : { session, room: null, selected: null, optimistic: null, wins: 0, matches: [] }),
  openRoom: (room) => set({ room, selected: null, optimistic: null }),
  syncRoom: (room) => set((state) => state.room?.code === room.code && room.revision > state.room.revision
    ? { room, selected: room.game_revision === state.room.game_revision ? state.selected : null,
      optimistic: state.optimistic && room.game_revision <= state.optimistic.version ? state.optimistic : null }
    : state),
  exit: () => set({ room: null, selected: null, optimistic: null }),
  previewMove: (optimistic) => set({ optimistic, selected: null }),
  select: (selected) => set({ selected }),
  setJoinCode: (joinCode) => set({ joinCode }),
  setHistory: (wins, matches) => set({ wins, matches }),
}));
