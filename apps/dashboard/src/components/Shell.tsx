import type { Subdivision } from "@guardhouse/api-types";
import { createContext, useContext } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router";
import { useCameraStatus, useSubdivision } from "../api/queries";
import { type StreamState, useEventStream } from "../api/useEventStream";
import { ROLE_LABEL, type Role, saveSession } from "../lib/session";
import { ErrorNote, Loading } from "./ui";

type Workspace = { sid: string; role: Role; subdivision: Subdivision; readOnly: boolean };

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace outside a subdivision screen");
  return workspace;
}

const NAV: Record<"guard" | "hoa", { to: string; label: string }[]> = {
  guard: [
    { to: "gate", label: "Gate" },
    { to: "today", label: "Today" },
    { to: "entries", label: "Entry log" },
    { to: "registry", label: "Registry" },
  ],
  hoa: [
    { to: "overview", label: "Overview" },
    { to: "houses", label: "Houses" },
    { to: "entries", label: "Entry log" },
  ],
};

/** Layout for guard and HOA officer screens: top bar, inactive banner, live updates. */
export function SubdivisionShell({ forRole: role }: { forRole: "guard" | "hoa" }) {
  const { sid = "" } = useParams();
  const subdivision = useSubdivision(sid);
  const stream = useEventStream(sid);

  if (subdivision.isPending) return <Loading />;
  if (subdivision.isError)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorNote error={subdivision.error} />
        <Link to="/" className="mt-4 inline-block text-sm text-teal underline">
          Pick a role again
        </Link>
      </div>
    );

  const workspace = {
    sid,
    role,
    subdivision: subdivision.data,
    readOnly: !subdivision.data.active,
  };

  return (
    <WorkspaceContext.Provider value={workspace}>
      <div className="min-h-screen">
        <TopBar workspace={workspace} stream={stream} />
        {workspace.readOnly && (
          <div className="border-b border-clay bg-clay-wash px-6 py-2.5 text-sm text-clay-deep">
            <strong className="font-semibold">{subdivision.data.name} is inactive.</strong> You can
            view its records, but you can't save entries or change the registry.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

function TopBar({ workspace, stream }: { workspace: Workspace; stream: StreamState }) {
  const navigate = useNavigate();
  const switchRole = () => {
    saveSession(null);
    navigate("/");
  };
  return (
    <header className="bg-ink text-almond">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-paper">{workspace.subdivision.name}</span>
          <span className="text-xs text-almond/70">{ROLE_LABEL[workspace.role]}</span>
        </div>
        <nav className="flex gap-1">
          {NAV[workspace.role as "guard" | "hoa"].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-almond text-ink" : "text-almond/85 hover:bg-white/10"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-xs">
          {workspace.role === "guard" && <CameraPill sid={workspace.sid} />}
          <StreamPill state={stream} />
          <button type="button" onClick={switchRole} className="text-almond/70 hover:text-paper">
            Switch role
          </button>
        </div>
      </div>
    </header>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={`size-2 rounded-full ${on ? "bg-[#7fd1b9]" : "bg-clay"}`} />;
}

function CameraPill({ sid }: { sid: string }) {
  const camera = useCameraStatus(sid);
  const online = camera.data?.online ?? false;
  return (
    <span className="flex items-center gap-1.5" title="Gate camera">
      <Dot on={online} /> Camera {online ? "online" : "offline"}
    </span>
  );
}

function StreamPill({ state }: { state: StreamState }) {
  const label = { connecting: "Connecting", live: "Live", reconnecting: "Reconnecting" }[state];
  return (
    <span className="flex items-center gap-1.5" title="Live updates from the server">
      <Dot on={state === "live"} /> {label}
    </span>
  );
}
