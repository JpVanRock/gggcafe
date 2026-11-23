// Live updates for a conversation (see live-updates.tsx), left out in the sample-data mode: the pages there are
// fictional, and a test build shouldn't open a connection to the real database.
import { sampleDataEnabled } from "@/lib/supabase/sample/enabled";
import { LiveUpdates } from "./live-updates";

export function Live(props: { table: "mentor_messages" | "video_call_messages"; column: string; value: string }) {
  if (sampleDataEnabled()) return null;
  return <LiveUpdates {...props} />;
}
