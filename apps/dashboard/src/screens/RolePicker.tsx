import { Link, useNavigate, useParams } from "react-router";
import { useSubdivisions } from "../api/queries";
import { Empty, ErrorNote, Loading } from "../components/ui";
import { homePath, ROLE_LABEL, type Role, readSession, saveSession } from "../lib/session";

const ROLES: { role: Role; what: string }[] = [
  { role: "guard", what: "Scan cars at the gate, record visitors, return held IDs." },
  { role: "hoa", what: "Keep the registry of houses and vehicles, and view entries." },
  { role: "provider", what: "Add subdivisions, set camera addresses, deactivate or reactivate." },
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink px-6 py-16 text-paper">
      <div className="mx-auto max-w-2xl">
        <p className="mb-1 text-sm tracking-widest text-clay uppercase">Guardhouse</p>
        {children}
        <p className="mt-12 text-xs text-almond/50">
          The role is saved in this browser only. It is not a login.
        </p>
      </div>
    </div>
  );
}

export function RolePicker() {
  const navigate = useNavigate();
  const last = readSession();

  const pick = (role: Role) => {
    if (role === "provider") {
      saveSession({ role });
      navigate("/provider");
    } else {
      navigate(`/pick/${role}`);
    }
  };

  return (
    <Frame>
      <h1 className="mb-8 text-3xl font-semibold">Who is using this screen?</h1>
      {last && (last.role === "provider" || last.subdivisionId) && (
        <Link
          to={homePath(last)}
          className="mb-6 block rounded-lg bg-teal px-5 py-4 hover:bg-teal-deep"
        >
          <span className="font-medium">Continue as {ROLE_LABEL[last.role]}</span>
          {last.subdivisionName && (
            <span className="text-almond/80"> at {last.subdivisionName}</span>
          )}
        </Link>
      )}
      <ul className="flex flex-col gap-3">
        {ROLES.map(({ role, what }) => (
          <li key={role}>
            <button
              type="button"
              onClick={() => pick(role)}
              className="w-full rounded-lg border border-almond/20 px-5 py-4 text-left hover:border-clay hover:bg-white/5"
            >
              <span className="block text-lg font-medium">{ROLE_LABEL[role]}</span>
              <span className="text-sm text-almond/75">{what}</span>
            </button>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function SubdivisionPicker() {
  const { role = "guard" } = useParams() as { role: "guard" | "hoa" };
  const navigate = useNavigate();
  const subdivisions = useSubdivisions();
  const active = subdivisions.data?.filter((s) => s.active) ?? [];

  const pick = (id: string, name: string) => {
    const session = { role, subdivisionId: id, subdivisionName: name };
    saveSession(session);
    navigate(homePath(session));
  };

  return (
    <Frame>
      <h1 className="mb-2 text-3xl font-semibold">Which subdivision?</h1>
      <p className="mb-8 text-almond/75">
        {ROLE_LABEL[role]} ·{" "}
        <Link to="/" className="underline">
          change role
        </Link>
      </p>
      <ErrorNote error={subdivisions.error} />
      {subdivisions.isPending ? (
        <Loading />
      ) : active.length === 0 ? (
        <Empty title="No active subdivisions">The provider adds subdivisions.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s.id, s.name)}
                className="w-full rounded-lg border border-almond/20 px-5 py-4 text-left hover:border-clay hover:bg-white/5"
              >
                <span className="block text-lg font-medium">{s.name}</span>
                {s.address && <span className="text-sm text-almond/75">{s.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}
