import { describe, expect, it } from "vitest";
import { getEngine } from "@/lib/sports/engines";
import { getSport, resolveConfig, SPORTS, sportOrDefault } from "@/lib/sports/registry";

describe("sport registry", () => {
  it("has unique sport ids", () => {
    const ids = SPORTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps every sport to a real engine", () => {
    for (const sport of SPORTS) {
      expect(getEngine(sport.engine).id).toBe(sport.engine);
    }
  });

  it("has sensible participant limits", () => {
    for (const sport of SPORTS) {
      expect(sport.minParticipants).toBeGreaterThanOrEqual(2);
      expect(sport.maxParticipants).toBeGreaterThanOrEqual(sport.minParticipants);
    }
  });

  it("returns a fresh defaults object on every call", () => {
    for (const sport of SPORTS) {
      const a = sport.defaults();
      const b = sport.defaults();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    }
  });
});

describe("getSport / sportOrDefault", () => {
  it("looks sports up by id", () => {
    expect(getSport("cricket")?.engine).toBe("cricket");
    expect(getSport("football")?.engine).toBe("timed");
    expect(getSport("table_tennis")?.engine).toBe("rally");
  });

  it("returns undefined for unknown ids", () => {
    expect(getSport("quidditch")).toBeUndefined();
  });

  it("falls back to the last registered sport", () => {
    expect(sportOrDefault("quidditch")).toBe(SPORTS[SPORTS.length - 1]);
    expect(sportOrDefault("tennis").id).toBe("tennis");
  });
});

describe("resolveConfig", () => {
  it("returns the sport defaults when nothing is stored", () => {
    expect(resolveConfig("tennis", null)).toEqual(getSport("tennis")!.defaults());
    expect(resolveConfig("tennis", undefined)).toEqual(getSport("tennis")!.defaults());
  });

  it("lets stored values override defaults while keeping missing keys", () => {
    const defaults = getSport("tennis")!.defaults();
    const [key] = Object.keys(defaults);
    const resolved = resolveConfig("tennis", { [key]: "stored", extra: 1 });
    expect(resolved[key]).toBe("stored");
    expect(resolved.extra).toBe(1);
    for (const k of Object.keys(defaults)) expect(resolved).toHaveProperty(k);
  });

  it("uses the default sport's config for unknown ids", () => {
    expect(resolveConfig("quidditch", {})).toEqual(sportOrDefault("quidditch").defaults());
  });
});
