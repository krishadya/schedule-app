export type ReplacementStatus = "pending" | "approved" | "declined" | "cancelled";

export type ReplacementRequest = {
  id: string;
  shift_id: string;
  requested_by: string;
  reason: string | null;
  status: ReplacementStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ReplacementActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const REPLACEMENT_COLUMNS =
  "id, shift_id, requested_by, reason, status, admin_note, created_at, resolved_at";

export const REPLACEMENT_TEXT_LIMIT = 500;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NOT_SET_UP_MESSAGE =
  "Replacement requests aren't set up yet. An admin needs to run the replacement requests database migration.";

// True when the replacement_requests table (or its function) hasn't been
// created yet, so pages can hide the feature instead of failing.
export function isMissingReplacementSchema(
  error: { code?: string | null; message?: string | null } | null,
) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /replacement_requests|resolve_replacement_request/.test(error.message ?? "")
  );
}

// The latest request per shift (requests should be ordered newest first).
export function latestRequestByShift(requests: ReplacementRequest[]) {
  const latest = new Map<string, ReplacementRequest>();

  for (const request of requests) {
    const current = latest.get(request.shift_id);
    if (!current || request.created_at > current.created_at) {
      latest.set(request.shift_id, request);
    }
  }

  return latest;
}
