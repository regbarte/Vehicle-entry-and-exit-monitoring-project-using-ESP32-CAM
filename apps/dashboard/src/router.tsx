import { createBrowserRouter, Navigate, useParams } from "react-router";
import { SubdivisionShell } from "./components/Shell";
import { EntryDetail } from "./screens/EntryDetail";
import { EntryLog } from "./screens/EntryLog";
import { Gate } from "./screens/guard/Gate";
import { RegistryLookup } from "./screens/guard/RegistryLookup";
import { Houses } from "./screens/hoa/Houses";
import { InsideNow } from "./screens/InsideNow";
import { EditSubdivision, NewSubdivision, Subdivisions } from "./screens/provider/Subdivisions";
import { RolePicker, SubdivisionPicker } from "./screens/RolePicker";

function EditSubdivisionRoute() {
  const { sid = "" } = useParams();
  return <EditSubdivision sid={sid} />;
}

const shared = [
  { path: "inside", element: <InsideNow /> },
  { path: "entries", element: <EntryLog /> },
  { path: "entries/:entryId", element: <EntryDetail /> },
];

export const router = createBrowserRouter([
  { path: "/", element: <RolePicker /> },
  { path: "/pick/:role", element: <SubdivisionPicker /> },
  {
    path: "/guard/:sid",
    element: <SubdivisionShell forRole="guard" />,
    children: [
      { index: true, element: <Navigate to="gate" replace /> },
      { path: "gate", element: <Gate /> },
      { path: "registry", element: <RegistryLookup /> },
      ...shared,
    ],
  },
  {
    path: "/hoa/:sid",
    element: <SubdivisionShell forRole="hoa" />,
    children: [
      { index: true, element: <Navigate to="houses" replace /> },
      { path: "houses", element: <Houses /> },
      ...shared,
    ],
  },
  { path: "/provider", element: <Subdivisions /> },
  { path: "/provider/new", element: <NewSubdivision /> },
  { path: "/provider/:sid/edit", element: <EditSubdivisionRoute /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
