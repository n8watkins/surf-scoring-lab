import { AlertTriangle, CheckCircle2, FileWarning, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { RunStatus } from "@/lib/types";
import { Badge } from "@/components/ui";

const map: Record<RunStatus, { tone: "success" | "warn" | "danger"; label: string; icon: ReactNode }> = {
  success: { tone: "success", label: "Success", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  response_parse_error: {
    tone: "warn",
    label: "Not valid JSON",
    icon: <FileWarning className="h-3.5 w-3.5" />,
  },
  api_error: { tone: "danger", label: "API error", icon: <XCircle className="h-3.5 w-3.5" /> },
  upload_error: { tone: "danger", label: "Upload error", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { tone, label, icon } = map[status];
  return (
    <Badge tone={tone}>
      {icon}
      {label}
    </Badge>
  );
}
