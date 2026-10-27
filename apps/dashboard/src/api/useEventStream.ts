import type { GateEvent } from "@guardhouse/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { applyEvent } from "./events";

export type StreamState = "connecting" | "live" | "reconnecting";

const EVENT_TYPES: GateEvent["type"][] = ["detection", "entry", "camera", "barrier"];

/** Open the subdivision's event stream once and keep the query cache current.
 * After a dropped connection it refetches everything for the subdivision. */
export function useEventStream(sid: string): StreamState {
  const client = useQueryClient();
  const [state, setState] = useState<StreamState>("connecting");

  useEffect(() => {
    const source = new EventSource(`/api/subdivisions/${sid}/events`);
    let dropped = false;

    source.onopen = () => {
      setState("live");
      if (dropped) {
        dropped = false;
        client.invalidateQueries({
          predicate: (query) => query.queryKey[1] === sid,
        });
      }
    };
    source.onerror = () => {
      dropped = true;
      setState("reconnecting");
    };
    const onMessage = (message: MessageEvent<string>) => {
      applyEvent(client, sid, JSON.parse(message.data) as GateEvent);
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, onMessage);

    return () => source.close();
  }, [client, sid]);

  return state;
}
