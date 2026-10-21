import { CrownIcon, EyeIcon, PencilIcon } from "lucide-react";
import type { Role } from "@/lib/client/types";

const MAP = {
  owner: { Icon: CrownIcon, label: "Owner" },
  editor: { Icon: PencilIcon, label: "Can edit" },
  viewer: { Icon: EyeIcon, label: "View only" },
} as const;

export function RoleChip({ role }: { role: Role }) {
  const { Icon, label } = MAP[role];
  return <span className={`chip chip--${role}`}><Icon className="i" aria-hidden />{label}</span>;
}
