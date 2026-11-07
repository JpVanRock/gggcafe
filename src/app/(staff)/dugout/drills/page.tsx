import type { Metadata } from "next";
import { Suspense } from "react";
import { canEdit, requireStaffPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Loading } from "@/components/ui";
import type { LibraryDrill } from "@/lib/dugout";
import { DrillLibrary } from "./library";

export const metadata: Metadata = { title: "Drill Library · Coaches Dugout · GGG.Cafe" };

export default function DrillLibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const user = await requireStaffPage();
  const supabase = await createClient();
  const { data } = await supabase.from("practice_drills").select("id, name, description, tags, equipment").order("name");
  return <DrillLibrary drills={(data ?? []) as LibraryDrill[]} canEdit={canEdit(user.staff.role)} />;
}
