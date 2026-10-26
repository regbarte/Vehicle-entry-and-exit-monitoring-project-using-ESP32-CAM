import { useWorkspace } from "../../components/Shell";
import { UsersPanel } from "../../components/UsersPanel";

/** The HOA officer adds the subdivision's guards and other HOA officers. */
export function Users() {
  const { sid, readOnly } = useWorkspace();
  return (
    <UsersPanel sid={sid} title="Users" roles={["guard", "hoa_officer"]} readOnly={readOnly} />
  );
}
