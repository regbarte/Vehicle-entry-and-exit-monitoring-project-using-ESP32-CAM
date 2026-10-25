import type { Detection, Entry, GateEvent } from "@guardhouse/api-types";
import type { QueryClient } from "@tanstack/react-query";
import { keys } from "./keys";

export function applyDetection(
  list: Detection[] | undefined,
  action: "added" | "removed",
  detection: Detection,
): Detection[] {
  const rest = (list ?? []).filter((d) => d.id !== detection.id);
  return action === "added" ? [...rest, detection] : rest;
}

/** Write one live update into the TanStack Query cache. */
export function applyEvent(client: QueryClient, sid: string, event: GateEvent) {
  switch (event.type) {
    case "detection":
      client.setQueryData<Detection[]>(keys.waiting(sid), (list) =>
        applyDetection(list, event.action, event.detection),
      );
      client.invalidateQueries({ queryKey: keys.statsToday(sid) });
      break;
    case "entry":
      client.setQueryData<Entry>(keys.entry(sid, event.entry.id), event.entry);
      client.invalidateQueries({ queryKey: keys.entries(sid) });
      client.invalidateQueries({ queryKey: keys.inside(sid) });
      client.invalidateQueries({ queryKey: keys.stats(sid) });
      break;
    case "camera":
      client.setQueryData(keys.camera(sid), event.camera);
      break;
  }
}
