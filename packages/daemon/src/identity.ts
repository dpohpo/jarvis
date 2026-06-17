/**
 * Daemon state on disk: ~/.jarvis/daemon.json (0600).
 * Long-term keys, room secret, paired devices, active pairing token.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import {
  type DeviceIdentity,
  deriveRoomId,
  fromB64,
  generateIdentity,
  randomBytes,
  toB64,
} from "@jarvis/protocol";

export interface PairedDevice {
  deviceId: string;
  name: string;
  boxPub: string; // base64
  signPub: string; // base64
  pairedAt: number;
}

export interface DaemonState {
  deviceId: string;
  boxPub: string;
  boxPriv: string;
  signPub: string;
  signPriv: string;
  roomSecret: string;
  relayUrl: string;
  workdir: string;
  devices: PairedDevice[];
  pairToken: { token: string; expiresAt: number } | null;
  /** Highest outgoing seq per peer — must survive restarts or peers drop us as duplicates. */
  channelSeqs?: Record<string, number>;
  /** Active workspace name (subdirectory of workdir). "" = workdir root. Survives restart. */
  activeWorkspace?: string;
}

const DIR = process.env.JARVIS_HOME ?? join(homedir(), ".jarvis");
const FILE = join(DIR, "daemon.json");

export function loadOrCreateState(relayUrl: string, workdir: string): DaemonState {
  if (existsSync(FILE)) {
    const state = JSON.parse(readFileSync(FILE, "utf8")) as DaemonState;
    // relay/workdir can change between runs; keys must not
    state.relayUrl = relayUrl;
    state.workdir = workdir;
    return state;
  }
  const id: DeviceIdentity = generateIdentity();
  const state: DaemonState = {
    deviceId: `daemon-${hostname().split(".")[0] ?? "mac"}`,
    boxPub: toB64(id.box.publicKey),
    boxPriv: toB64(id.box.privateKey),
    signPub: toB64(id.sign.publicKey),
    signPriv: toB64(id.sign.privateKey),
    roomSecret: toB64(randomBytes(32)),
    relayUrl,
    workdir,
    devices: [],
    pairToken: null,
  };
  saveState(state);
  return state;
}

export function saveState(state: DaemonState): void {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  chmodSync(FILE, 0o600);
}

export function roomOf(state: DaemonState): string {
  return deriveRoomId(fromB64(state.roomSecret));
}

export function issuePairToken(state: DaemonState): string {
  const token = toB64(randomBytes(16));
  state.pairToken = { token, expiresAt: Date.now() + 5 * 60_000 };
  saveState(state);
  return token;
}

export function consumePairToken(state: DaemonState, token: string): boolean {
  const t = state.pairToken;
  if (!t || t.token !== token || Date.now() > t.expiresAt) return false;
  state.pairToken = null; // single use
  saveState(state);
  return true;
}

export function addDevice(state: DaemonState, dev: PairedDevice): void {
  state.devices = state.devices.filter((d) => d.deviceId !== dev.deviceId);
  state.devices.push(dev);
  saveState(state);
}
