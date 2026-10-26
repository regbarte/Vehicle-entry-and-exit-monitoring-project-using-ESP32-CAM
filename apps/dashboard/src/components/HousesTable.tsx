import type { House } from "@guardhouse/api-types";
import type { ReactNode } from "react";
import { formatDateTime } from "../lib/format";
import { Plate, Table } from "./ui";

export function HousesTable({
  houses,
  actions,
}: {
  houses: House[];
  actions?: (house: House) => ReactNode;
}) {
  return (
    <Table
      head={[
        "House",
        "Owner",
        "Contact",
        "Registered vehicle",
        "Updated",
        ...(actions ? [""] : []),
      ]}
    >
      {houses.map((house) => (
        <tr key={house.id}>
          <td className="px-4 py-3">
            <p className="font-medium whitespace-nowrap">{house.label}</p>
            {house.street && <p className="text-xs text-ink-soft">{house.street}</p>}
          </td>
          <td className="px-4 py-3">{house.ownerName}</td>
          <td className="px-4 py-3 text-ink-soft">{house.contact}</td>
          <td className="px-4 py-3">
            {house.vehicle ? (
              <Plate plate={house.vehicle.plate} />
            ) : (
              <span className="text-ink-soft">None</span>
            )}
          </td>
          <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
            {formatDateTime(house.updatedAt)}
          </td>
          {actions && <td className="px-4 py-3 text-right whitespace-nowrap">{actions(house)}</td>}
        </tr>
      ))}
    </Table>
  );
}
