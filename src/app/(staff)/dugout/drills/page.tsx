import type { Metadata } from "next";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { LibraryDrill } from "@/lib/dugout";
import { DrillLibrary } from "./library";

export const metadata: Metadata = { title: "Drill Library · Coaches Dugout · GGG.Cafe" };

export default async function DrillLibraryPage() {
  const user = await requireStaffPage();
  const supabase = await createClient();
  const { data } = await supabase.from("practice_drills").select("id, name, description, tags, equipment, video_url").order("name");
  return <DrillLibrary drills={(data ?? []) as LibraryDrill[]} canEdit={canEdit(user.staff.role)} />;
}
