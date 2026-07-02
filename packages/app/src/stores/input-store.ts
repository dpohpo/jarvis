/**
 * Input store — composer text + recording state.
 *
 * Tiny enough to live in component state, but pulling it into a store
 * lets the wakeword auto-listen flow (Phase 14) reset the input from
 * outside the Composer component.
 */
import { create } from "zustand";

export type RecMode = "hold" | "tap" | "auto" | null;

interface InputState {
  input: string;
  recording: boolean;
  recMode: RecMode;
  showSlash: boolean;
  setInput: (t: string) => void;
  setRecording: (v: boolean) => void;
  setRecMode: (m: RecMode) => void;
  setShowSlash: (v: boolean) => void;
  reset: () => void;
}

export const useInputStore = create<InputState>((set) => ({
  input: "",
  recording: false,
  recMode: null,
  showSlash: false,
  setInput: (t) => set({ input: t, showSlash: t.startsWith("/") }),
  setRecording: (v) => set({ recording: v }),
  setRecMode: (m) => set({ recMode: m }),
  setShowSlash: (v) => set({ showSlash: v }),
  reset: () => set({ input: "", recording: false, recMode: null, showSlash: false }),
}));
