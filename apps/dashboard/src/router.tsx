import { createBrowserRouter, Navigate, useParams } from "react-router";
import { SubdivisionShell } from "./components/Shell";
import { EntryDetail } from "./screens/EntryDetail";
import { EntryLog } from "./screens/EntryLog";
import { Gate } from "./screens/guard/Gate";
import { RegistryLookup } from "./screens/guard/RegistryLookup";
import { Today } from "./screens/guard/Today";
import { Grid } from "./screens/hoa/Grid";
import { Houses } from "./screens/hoa/Houses";
import { Overview } from "./screens/hoa/Overview";
import { Users } from "./screens/hoa/Users";
import {
  EditSubdivision,
  NewSubdivision,
  SubdivisionOfficers,
  Subdivisions,
} from "./screens/provider/Subdivisions";
import { RolePicker, SubdivisionPicker } from "./screens/RolePicker";

function EditSubdivisionRoute() {
  const { sid = "" } = useParams();
  return <EditSubdivision sid={sid} />;
}

function SubdivisionOfficersRoute() {
  const { sid = "" } = useParams();
  return <SubdivisionOfficers sid={sid} />;
}

const shared = [
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
      { path: "today", element: <Today /> },
      { path: "registry", element: <RegistryLookup /> },
      ...shared,
    ],
  },
  {
    path: "/hoa/:sid",
    element: <SubdivisionShell forRole="hoa" />,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: "overview", element: <Overview /> },
      { path: "grid", element: <Grid /> },
      { path: "houses", element: <Houses /> },
      { path: "users", element: <Users /> },
      ...shared,
    ],
  },
  { path: "/provider", element: <Subdivisions /> },
  { path: "/provider/new", element: <NewSubdivision /> },
  { path: "/provider/:sid/edit", element: <EditSubdivisionRoute /> },
  { path: "/provider/:sid/officers", element: <SubdivisionOfficersRoute /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
