import type { UserRole } from "@guardhouse/api-types";
import { type FormEvent, useState } from "react";
import { useAddUser, useUsers } from "../api/queries";
import { formatDateTime } from "../lib/format";
import { Button, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Table } from "./ui";

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  guard: "Guard",
  hoa_officer: "HOA officer",
};

/**
 * A subdivision's user accounts, and an Add user form limited to `roles`. The
 * prototype stores accounts without passwords; logins come with the cloud side.
 */
export function UsersPanel({
  sid,
  title,
  roles,
  readOnly,
}: {
  sid: string;
  title: string;
  roles: UserRole[];
  readOnly: boolean;
}) {
  const users = useUsers(sid);
  const [adding, setAdding] = useState(false);
  const shown = users.data?.filter((u) => roles.includes(u.role));

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <PageHeader
          title={title}
          actions={
            !readOnly && (
              <Button variant="primary" onClick={() => setAdding(true)}>
                Add user
              </Button>
            )
          }
        />
        <ErrorNote error={users.error} />
        {users.isPending ? (
          <Loading />
        ) : shown?.length === 0 ? (
          <Empty title="No users yet">Add the people who will sign in for this subdivision.</Empty>
        ) : (
          <Table head={["Name", "Email", "Role", "Added"]}>
            {shown?.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-ink-soft">{user.email}</td>
                <td className="px-4 py-3">{USER_ROLE_LABEL[user.role]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                  {formatDateTime(user.createdAt)}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      {adding && <UserForm sid={sid} roles={roles} onDone={() => setAdding(false)} />}
    </div>
  );
}

function UserForm({ sid, roles, onDone }: { sid: string; roles: UserRole[]; onDone: () => void }) {
  const add = useAddUser(sid);
  const [form, setForm] = useState({ name: "", email: "", role: roles[0] });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(form, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 self-start rounded-lg border border-line bg-white p-6 xl:sticky xl:top-6"
    >
      <h2 className="text-lg font-semibold">Add a user</h2>
      <Field label="Name">
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </Field>
      <Field label="Email" hint="They will sign in with this once logins are added.">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
      </Field>
      {roles.length > 1 && (
        <Field label="Role">
          <Select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <ErrorNote error={add.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Add user"}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
