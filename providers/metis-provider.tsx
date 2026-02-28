"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface DashboardContextData {
  filters?: Record<string, unknown>;
  visibleData?: Record<string, unknown>;
  activeTab?: string;
}

interface MetisContextValue {
  dashboardContext: DashboardContextData | undefined;
  setDashboardContext: (ctx: DashboardContextData) => void;
}

const MetisContext = createContext<MetisContextValue | undefined>(undefined);

export function MetisProvider({ children }: { children: ReactNode }) {
  const [dashboardContext, setDashboardContextState] = useState<DashboardContextData>();

  const setDashboardContext = useCallback((ctx: DashboardContextData) => {
    setDashboardContextState(ctx);
  }, []);

  return (
    <MetisContext.Provider value={{ dashboardContext, setDashboardContext }}>
      {children}
    </MetisContext.Provider>
  );
}

export function useMetisContext() {
  const ctx = useContext(MetisContext);
  if (!ctx) {
    throw new Error("useMetisContext must be used within MetisProvider");
  }
  return ctx;
}
