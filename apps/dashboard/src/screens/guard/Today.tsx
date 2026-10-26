import { Link, useNavigate } from "react-router";
import { useEntries, useTodayStats } from "../../api/queries";
import { HourlyChart, VerdictArc } from "../../components/charts";
import { useWorkspace } from "../../components/Shell";
import {
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Plate,
  StatTile,
  VerdictBadge,
} from "../../components/ui";
import { formatTime, localToday } from "../../lib/format";
import { destinationText } from "../EntryLog";
import { InsideNowList } from "../InsideNow";

/** The guard's summary of today: counts, charts, who is inside and the latest entries. */
export function Today() {
  const { sid } = useWorkspace();
  const navigate = useNavigate();
  const stats = useTodayStats(sid);
  const entries = useEntries(sid, { date: localToday() });
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Today" />
      <ErrorNote error={stats.error} />
      {stats.isPending && <Loading />}
      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Entries today"
              value={s.entries}
              note={`${s.registered} registered, ${s.visitors} visitors`}
            />
            <StatTile
              label="Visitors inside"
              value={s.inside}
              note={s.inside === 1 ? "You're holding 1 ID" : `You're holding ${s.inside} IDs`}
            />
            <StatTile
              label="Waiting list"
              value={s.waiting}
              note={
                s.waiting ? (
                  <Link to="../gate" className="text-teal underline">
                    Go to the gate
                  </Link>
                ) : (
                  "No cars waiting"
                )
              }
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card title="Registered and visitors">
              <VerdictArc registered={s.registered} visitors={s.visitors} />
            </Card>
            <Card title="Entries per hour today">
              <HourlyChart data={s.byHour} description="Entries per hour today, by verdict." />
            </Card>
          </div>
        </>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Inside now">
          <InsideNowList />
        </Card>
        <Card
          title="Latest entries"
          actions={
            <Link to="../entries" className="text-sm text-teal underline">
              Open the entry log
            </Link>
          }
        >
          {entries.data?.length === 0 ? (
            <Empty title="No entries today" />
          ) : (
            <ul className="divide-y divide-line">
              {entries.data?.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`../entries/${entry.id}`)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 text-left hover:bg-paper"
                  >
                    <span className="w-16 text-sm tabular-nums">{formatTime(entry.at)}</span>
                    <Plate plate={entry.plate} />
                    <VerdictBadge verdict={entry.verdict} />
                    <span className="text-sm text-ink-soft">{destinationText(entry)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
