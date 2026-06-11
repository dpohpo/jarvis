/**
 * Phone-side persistent state, kept in SecureStore (hardware-backed keystore on
 * Android). Single JSON item — well under the 2048-byte Android value limit.
 */
import * as SecureStore from "expo-secure-store";

export interface PhoneState {
  deviceId: string;
  boxPub: string;
  boxPriv: string;
  signPub: string;
  signPriv: string;
  relayUrl: string;
  room: string;
  daemonDeviceId: string;
  daemonBoxPub: string;
  /** Highest daemon seq processed (hello.resumeFrom). */
  lastSeq: number;
  /** Highest seq sent — outbox continues from here after restart. */
  sentSeq: number;
}

const KEY = "jarvis_state_v1";

export async function loadState(): Promise<PhoneState | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as PhoneState) : null;
}

export async function saveState(s: PhoneState): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
}

export async function clearState(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
