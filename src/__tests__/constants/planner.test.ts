import { describe, it, expect } from "vitest";
import { SEASON_COLORS, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH } from "@/constants/planner";

describe("planner constants", () => {
  it("exports SEASON_COLORS with Fall, Spring, Summer", () => {
    expect(SEASON_COLORS).toEqual({
      Fall: "orange",
      Spring: "blue",
      Summer: "yellow",
    });
  });

  it("exports MIN_PANEL_WIDTH as 300", () => {
    expect(MIN_PANEL_WIDTH).toBe(300);
  });

  it("exports MAX_PANEL_WIDTH as 550", () => {
    expect(MAX_PANEL_WIDTH).toBe(550);
  });

  it("MIN_PANEL_WIDTH is less than MAX_PANEL_WIDTH", () => {
    expect(MIN_PANEL_WIDTH).toBeLessThan(MAX_PANEL_WIDTH);
  });
});
