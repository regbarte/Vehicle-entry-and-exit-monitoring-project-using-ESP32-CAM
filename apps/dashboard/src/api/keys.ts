export type EntryFilters = { plate?: string; date?: string; verdict?: "registered" | "visitor" };

export const keys = {
  subdivisions: ["subdivisions"] as const,
  subdivision: (sid: string) => ["subdivision", sid] as const,
  waiting: (sid: string) => ["waiting", sid] as const,
  camera: (sid: string) => ["camera", sid] as const,
  entries: (sid: string, filters?: EntryFilters) =>
    filters ? (["entries", sid, filters] as const) : (["entries", sid] as const),
  inside: (sid: string) => ["inside", sid] as const,
  entry: (sid: string, id: string) => ["entry", sid, id] as const,
  houses: (sid: string, q?: string) =>
    q === undefined ? (["houses", sid] as const) : (["houses", sid, q] as const),
  stats: (sid: string) => ["stats", sid] as const,
  statsToday: (sid: string) => ["stats", sid, "today"] as const,
  statsHourly: (sid: string, days: StatsDays) => ["stats", sid, "hourly", days] as const,
  statsPurposes: (sid: string) => ["stats", sid, "purposes"] as const,
};

export type StatsDays = 7 | 30;
