import { redirect } from "next/navigation";

// The old admin hub only linked to other pages. Shifts and Staff are now in
// the main navigation, so send old bookmarks to the shift list.
export default function AdminPage() {
  redirect("/admin/shifts");
}
