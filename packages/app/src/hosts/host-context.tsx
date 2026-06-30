/**
 * Host Context — provides host list and current host selection.
 *
 * Phase 1 stub: returns a single "local" host. Protocol layer will add
 * host.list / host.register / host.disconnect later.
 */

import { createContext, useContext, useState, ReactNode } from "react";
import type { HostInfo } from "./host-types";

interface HostContextValue {
  /** All discovered hosts. */
  hosts: HostInfo[];
  /** Currently selected host (or null if none). */
  currentHost: HostInfo | null;
  /** Switch to a different host. */
  setCurrentHost: (host: HostInfo | null) => void;
}

const HostContext = createContext<HostContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

/** Host Provider — wraps the app to provide host state. */
export function HostProvider({ children }: ProviderProps) {
  // Phase 1 stub: single local host. Protocol will push host.state later.
  const [hosts] = useState<HostInfo[]>([
    {
      id: "local",
      name: "本机",
      platform: "ios",
      lastSeen: Date.now(),
    },
  ]);
  const [currentHost, setCurrentHost] = useState<HostInfo | null>(hosts[0] ?? null);

  return (
    <HostContext.Provider value={{ hosts, currentHost, setCurrentHost }}>
      {children}
    </HostContext.Provider>
  );
}

/** useHosts — access host state from any component. */
export function useHosts(): HostContextValue {
  const ctx = useContext(HostContext);
  if (!ctx) {
    throw new Error("useHosts must be used within HostProvider");
  }
  return ctx;
}
