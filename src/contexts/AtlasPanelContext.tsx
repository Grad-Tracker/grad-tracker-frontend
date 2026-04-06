"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AtlasPanelContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AtlasPanelContext = createContext<AtlasPanelContextValue | null>(null);

export function AtlasPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AtlasPanelContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
      }}
    >
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
