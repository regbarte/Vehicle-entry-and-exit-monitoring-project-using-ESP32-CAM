import type {
  CameraStatus,
  Detection,
  Entry,
  HouseCreate,
  HouseUpdate,
  Purpose,
  SubdivisionCreate,
  SubdivisionUpdate,
} from "@guardhouse/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import { type EntryFilters, keys, type StatsDays } from "./keys";

const path = (sid: string) => ({ path: { sid } });

// Subdivisions

export function useSubdivisions() {
  return useQuery({
    queryKey: keys.subdivisions,
    queryFn: () => unwrap(api.GET("/api/subdivisions")),
  });
}

export function useSubdivision(sid: string) {
  return useQuery({
    queryKey: keys.subdivision(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}", { params: path(sid) })),
  });
}

export function useCreateSubdivision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SubdivisionCreate) => unwrap(api.POST("/api/subdivisions", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.subdivisions }),
  });
}

export function useUpdateSubdivision(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SubdivisionUpdate) =>
      unwrap(api.PATCH("/api/subdivisions/{sid}", { params: path(sid), body })),
    onSuccess: (subdivision) => {
      client.setQueryData(keys.subdivision(sid), subdivision);
      client.invalidateQueries({ queryKey: keys.subdivisions });
    },
  });
}

// Gate

export function useWaiting(sid: string) {
  return useQuery({
    queryKey: keys.waiting(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}/waiting", { params: path(sid) })),
  });
}

export function useCameraStatus(sid: string) {
  return useQuery<CameraStatus>({
    queryKey: keys.camera(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}/camera/status", { params: path(sid) })),
  });
}

function addWaiting(list: Detection[] | undefined, detection: Detection): Detection[] {
  const rest = (list ?? []).filter((d) => d.id !== detection.id);
  return [...rest, detection];
}

export function useScan(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/subdivisions/{sid}/scan", { params: path(sid) })),
    // The SSE `detection` event also adds it; adding here keeps the gate responsive
    // when the stream is reconnecting.
    onSuccess: (detection) =>
      client.setQueryData<Detection[]>(keys.waiting(sid), (list) => addWaiting(list, detection)),
  });
}

function dropWaiting(client: ReturnType<typeof useQueryClient>, sid: string, id: string) {
  client.setQueryData<Detection[]>(keys.waiting(sid), (list) => list?.filter((d) => d.id !== id));
}

export function useConfirm(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ detectionId, plate }: { detectionId: string; plate: string }) =>
      unwrap(
        api.POST("/api/subdivisions/{sid}/detections/{detection_id}/confirm", {
          params: { path: { sid, detection_id: detectionId } },
          body: { plate },
        }),
      ),
    onSuccess: (result, { detectionId }) => {
      if (result.verdict === "registered") {
        dropWaiting(client, sid, detectionId);
        client.invalidateQueries({ queryKey: keys.entries(sid) });
        client.invalidateQueries({ queryKey: keys.stats(sid) });
      }
    },
  });
}

export function useDismiss(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (detectionId: string) =>
      unwrap(
        api.DELETE("/api/subdivisions/{sid}/detections/{detection_id}", {
          params: { path: { sid, detection_id: detectionId } },
        }),
      ),
    onSuccess: (_, detectionId) => dropWaiting(client, sid, detectionId),
  });
}

export type VisitorEntryInput = {
  detectionId: string;
  plate: string;
  purpose: Purpose;
  destination: { kind: "block"; block: string } | { kind: "residence"; houseId: string };
  idPhoto: Blob | null;
};

export function useSaveVisitor(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: VisitorEntryInput) =>
      unwrap(
        api.POST("/api/subdivisions/{sid}/entries/visitor", {
          params: path(sid),
          // The generated body type describes the form fields; FormData carries them.
          body: {} as never,
          bodySerializer: () => {
            const form = new FormData();
            form.set("detectionId", input.detectionId);
            form.set("plate", input.plate);
            form.set("purpose", input.purpose);
            form.set("destination", JSON.stringify(input.destination));
            if (input.idPhoto) form.set("idPhoto", input.idPhoto, "id-photo.jpg");
            return form;
          },
        }),
      ),
    onSuccess: (_, { detectionId }) => {
      dropWaiting(client, sid, detectionId);
      client.invalidateQueries({ queryKey: keys.entries(sid) });
      client.invalidateQueries({ queryKey: keys.inside(sid) });
      client.invalidateQueries({ queryKey: keys.stats(sid) });
    },
  });
}

// Entries

export function useEntries(sid: string, filters: EntryFilters) {
  return useQuery({
    queryKey: keys.entries(sid, filters),
    queryFn: () =>
      unwrap(
        api.GET("/api/subdivisions/{sid}/entries", {
          params: {
            path: { sid },
            query: {
              plate: filters.plate || undefined,
              date: filters.date || undefined,
              verdict: filters.verdict,
            },
          },
        }),
      ),
  });
}

export function useInside(sid: string) {
  return useQuery({
    queryKey: keys.inside(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}/entries/inside", { params: path(sid) })),
  });
}

export function useEntry(sid: string, id: string) {
  return useQuery({
    queryKey: keys.entry(sid, id),
    queryFn: () =>
      unwrap(
        api.GET("/api/subdivisions/{sid}/entries/{entry_id}", {
          params: { path: { sid, entry_id: id } },
        }),
      ),
  });
}

export function useReturnId(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      unwrap(
        api.POST("/api/subdivisions/{sid}/entries/{entry_id}/return-id", {
          params: { path: { sid, entry_id: entryId } },
        }),
      ),
    onSuccess: (entry: Entry) => {
      client.setQueryData(keys.entry(sid, entry.id), entry);
      client.setQueryData<Entry[]>(keys.inside(sid), (list) =>
        list?.filter((e) => e.id !== entry.id),
      );
      client.invalidateQueries({ queryKey: keys.entries(sid) });
      client.invalidateQueries({ queryKey: keys.statsToday(sid) });
    },
  });
}

// Stats: totals for the guard's Today and the HOA officer's Overview

export function useTodayStats(sid: string) {
  return useQuery({
    queryKey: keys.statsToday(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}/stats/today", { params: path(sid) })),
  });
}

export function useHourlyStats(sid: string, days: StatsDays) {
  return useQuery({
    queryKey: keys.statsHourly(sid, days),
    queryFn: () =>
      unwrap(
        api.GET("/api/subdivisions/{sid}/stats/hourly", {
          params: { path: { sid }, query: { days } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function usePurposeStats(sid: string) {
  return useQuery({
    queryKey: keys.statsPurposes(sid),
    queryFn: () => unwrap(api.GET("/api/subdivisions/{sid}/stats/purposes", { params: path(sid) })),
  });
}

export function useHouseStats(sid: string, days: StatsDays) {
  return useQuery({
    queryKey: keys.statsHouses(sid, days),
    queryFn: () =>
      unwrap(
        api.GET("/api/subdivisions/{sid}/stats/houses", {
          params: { path: { sid }, query: { days } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

// Registry

export function useHouses(sid: string, q: string) {
  return useQuery({
    queryKey: keys.houses(sid, q),
    queryFn: () =>
      unwrap(
        api.GET("/api/subdivisions/{sid}/houses", { params: { path: { sid }, query: { q } } }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useAddHouse(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: HouseCreate) =>
      unwrap(api.POST("/api/subdivisions/{sid}/houses", { params: path(sid), body })),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.houses(sid) }),
  });
}

export function useEditHouse(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: HouseUpdate }) =>
      unwrap(
        api.PATCH("/api/subdivisions/{sid}/houses/{house_id}", {
          params: { path: { sid, house_id: id } },
          body,
        }),
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.houses(sid) }),
  });
}

export function useRemoveHouse(sid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(
        api.DELETE("/api/subdivisions/{sid}/houses/{house_id}", {
          params: { path: { sid, house_id: id } },
        }),
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.houses(sid) }),
  });
}
