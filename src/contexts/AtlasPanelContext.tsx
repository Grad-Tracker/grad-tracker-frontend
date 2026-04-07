"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AtlasPanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AtlasPanelContext = createContext<AtlasPanelContextValue | null>(null);

export function AtlasPanelProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<AtlasPanelContextValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen]
  );

  return (
    <AtlasPanelContext.Provider value={value}>
      {children}
    </AtlasPanelContext.Provider>
  );
}

export function useAtlasPanel(): AtlasPanelContextValue {
  const ctx = useContext(AtlasPanelContext);
  if (!ctx) {
    throw new Error("useAtlasPanel must be used within AtlasPanelProvider");
  }
  return ctx;
}
