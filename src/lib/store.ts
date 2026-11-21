import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Match, Room } from "./rooms";

type State = {
  session: Session | null;
  room: Room | null;
  selected: number | null;
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
  session: null, room: null, selected: null, joinCode: "", wins: 0, matches: [],
  setSession: (session) => set((state) => session?.user.id === state.session?.user.id
    ? { session }
    : { session, room: null, selected: null, wins: 0, matches: [] }),
  openRoom: (room) => set({ room, selected: null }),
  syncRoom: (room) => set((state) => state.room?.code === room.code && room.revision > state.room.revision
    ? { room, selected: room.game_revision === state.room.game_revision ? state.selected : null }
    : state),
  exit: () => set({ room: null, selected: null }),
  select: (selected) => set({ selected }),
  setJoinCode: (joinCode) => set({ joinCode }),
  setHistory: (wins, matches) => set({ wins, matches }),
}));
