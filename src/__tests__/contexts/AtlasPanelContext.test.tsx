import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { AtlasPanelProvider, useAtlasPanel } from "@/contexts/AtlasPanelContext";

describe("AtlasPanelContext", () => {
  it("throws when useAtlasPanel is called outside provider", () => {
    expect(() => {
      renderHook(() => useAtlasPanel());
    }).toThrow("useAtlasPanel must be used within AtlasPanelProvider");
  });

  it("provides open/close/toggle controls", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AtlasPanelProvider, null, children);

    const { result } = renderHook(() => useAtlasPanel(), { wrapper });

    expect(result.current.isOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });
});
