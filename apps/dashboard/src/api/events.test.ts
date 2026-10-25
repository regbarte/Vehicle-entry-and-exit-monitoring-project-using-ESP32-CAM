import type { Detection } from "@guardhouse/api-types";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { applyDetection, applyEvent } from "./events";
import { keys } from "./keys";

const detection = (id: string): Detection => ({
  id,
  subdivisionId: "s1",
  at: "2026-10-25T02:00:00Z",
  source: "scan",
  plateReading: "NBC 1234",
  frameUrl: `/files/frames/s1/${id}.jpg`,
  suggestions: [],
});

describe("applyDetection", () => {
  it("adds to the end and removes by id", () => {
    const list = applyDetection(
      applyDetection([], "added", detection("a")),
      "added",
      detection("b"),
    );
    expect(list.map((d) => d.id)).toEqual(["a", "b"]);
    expect(applyDetection(list, "removed", detection("a")).map((d) => d.id)).toEqual(["b"]);
  });
  it("does not duplicate a detection the scan response already added", () => {
    const list = applyDetection([detection("a")], "added", detection("a"));
    expect(list).toHaveLength(1);
  });
});

describe("applyEvent", () => {
  it("writes camera status into the cache", () => {
    const client = new QueryClient();
    const camera = { online: true, uptimeSeconds: 5, signalDbm: -60, checkedAt: null };
    applyEvent(client, "s1", { type: "camera", camera });
    expect(client.getQueryData(keys.camera("s1"))).toEqual(camera);
  });
});
