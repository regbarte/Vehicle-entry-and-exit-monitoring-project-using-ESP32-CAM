import { useState } from "react";
import { useHouses } from "../../api/queries";
import { HousesTable } from "../../components/HousesTable";
import { useWorkspace } from "../../components/Shell";
import { Empty, ErrorNote, Input, Loading, PageHeader } from "../../components/ui";

/** Read-only for the guard. The HOA officer maintains the registry. */
export function RegistryLookup() {
  const { sid } = useWorkspace();
  const [q, setQ] = useState("");
  const houses = useHouses(sid, q);

  return (
    <>
      <PageHeader title="Registry" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by plate, owner, block or lot"
        aria-label="Search the registry"
        className="mb-4 w-full max-w-md"
      />
      <ErrorNote error={houses.error} />
      {houses.isPending ? (
        <Loading />
      ) : houses.data?.length === 0 ? (
        <Empty title={q ? `Nothing matches “${q}”` : "The registry is empty"}>
          {q ? "Check the spelling, or search by block and lot." : "The HOA officer adds houses."}
        </Empty>
      ) : (
        <HousesTable houses={houses.data ?? []} />
      )}
    </>
  );
}
