import { describe, it, expect } from "vitest";
import { getProgramColor, getProgramTypeLabel } from "@/lib/program-colors";

describe("getProgramColor", () => {
  it("returns 'blue' for MAJOR", () => {
    expect(getProgramColor("MAJOR")).toBe("blue");
  });

  it("returns 'purple' for MINOR", () => {
    expect(getProgramColor("MINOR")).toBe("purple");
  });

  it("returns 'green' for GRADUATE", () => {
    expect(getProgramColor("GRADUATE")).toBe("green");
  });

  it("returns 'orange' for CERTIFICATE", () => {
    expect(getProgramColor("CERTIFICATE")).toBe("orange");
  });

  it("returns 'gray' for an unknown program type", () => {
    expect(getProgramColor("UNKNOWN")).toBe("gray");
  });

  it("returns 'gray' for an empty string", () => {
    expect(getProgramColor("")).toBe("gray");
  });
});

describe("getProgramTypeLabel", () => {
  it("returns 'Major' for MAJOR", () => {
    expect(getProgramTypeLabel("MAJOR")).toBe("Major");
  });

  it("returns 'Minor' for MINOR", () => {
    expect(getProgramTypeLabel("MINOR")).toBe("Minor");
  });

  it("returns 'Graduate' for GRADUATE", () => {
    expect(getProgramTypeLabel("GRADUATE")).toBe("Graduate");
  });

  it("returns 'Certificate' for CERTIFICATE", () => {
    expect(getProgramTypeLabel("CERTIFICATE")).toBe("Certificate");
  });

  it("returns the raw type string for an unknown type", () => {
    expect(getProgramTypeLabel("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });

  it("returns an empty string for an empty input", () => {
    expect(getProgramTypeLabel("")).toBe("");
  });
});
