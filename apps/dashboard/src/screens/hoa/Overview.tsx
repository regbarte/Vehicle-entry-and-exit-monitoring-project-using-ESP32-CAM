import { useState } from "react";
import { Link } from "react-router";
import type { StatsDays } from "../../api/keys";
import { useHourlyStats, useHouses, usePurposeStats } from "../../api/queries";
import { HourlyChart, PurposeBars } from "../../components/charts";
import { useWorkspace } from "../../components/Shell";
import { Card, ErrorNote, Loading, PageHeader, Segmented, StatTile } from "../../components/ui";
import { formatDate } from "../../lib/format";

const WINDOWS: { value: StatsDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

/** The HOA officer's landing page: the registry at a glance and gate totals. */
export function Overview() {
  const { sid } = useWorkspace();
  const houses = useHouses(sid, "");
  const [days, setDays] = useState<StatsDays>(7);
  const hourly = useHourlyStats(sid, days);
  const purposes = usePurposeStats(sid);

  const list = houses.data ?? [];
  const withVehicle = list.filter((h) => h.vehicle).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const updatedThisMonth = list.filter((h) => new Date(h.updatedAt) >= monthStart).length;
  const recent = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" />
      <ErrorNote error={houses.error ?? hourly.error ?? purposes.error} />
      {houses.isPending ? (
        <Loading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Houses" value={list.length} />
          <StatTile label="With a vehicle" value={withVehicle} />
          <StatTile label="Without a vehicle" value={list.length - withVehicle} />
          <StatTile label="Updated this month" value={updatedThisMonth} />
        </div>
      )}

      {recent.length > 0 && (
        <Card
          title="Recently updated houses"
          actions={
            <Link to="../houses" className="text-sm text-teal underline">
              Open houses
            </Link>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((house) => (
              <li key={house.id} className="flex flex-col gap-1 rounded-md border border-line p-3">
                <span className="font-medium">{house.label}</span>
                <span className="text-sm">{house.ownerName}</span>
                {house.vehicle ? (
                  <span className="font-mono text-sm text-ink-soft">
                    {house.vehicle.plateDisplay}
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">No vehicle</span>
                )}
                <span className="text-xs text-ink-soft">Updated {formatDate(house.updatedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title={`Entries by hour of day, last ${days} days`}
          actions={
            <Segmented label="Time window" options={WINDOWS} value={days} onChange={setDays} />
          }
        >
          {hourly.data ? (
            <HourlyChart
              data={hourly.data.byHour}
              description={`Entries by hour of day over the last ${days} days, by verdict.`}
            />
          ) : (
            <Loading />
          )}
        </Card>
        <Card title="Visitors by purpose, last 7 days">
          {purposes.data ? (
            <PurposeBars
              data={purposes.data.purposes}
              description="Visitors by purpose over the last 7 days."
            />
          ) : (
            <Loading />
          )}
        </Card>
      </div>
    </div>
  );
}
