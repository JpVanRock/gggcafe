import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePlayerPage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_COLUMNS, signedMessagePhotoUrls, type MentorMessage } from "@/lib/message-photos";
import { EmptyState, Loading } from "@/components/ui";
import { MessageCard } from "../../mentor-messages";
import { GotIt } from "../../messages-client";
import { firstName, loadPlayer } from "../../section-data";
import { SectionShell } from "../section-shell";

export const metadata: Metadata = { title: "Messages · GGG.Cafe" };

export default function MessagesPage({ params }: PageProps<"/players/[playerId]/messages">) {
  return (
    <Suspense fallback={<Loading />}>
      <Messages params={params} />
    </Suspense>
  );
}

async function Messages({ params }: Pick<PageProps<"/players/[playerId]/messages">, "params">) {
  const { playerId } = await params;
  const supabase = await createClient();
  const access = await requirePlayerPage(playerId);
  const player = await loadPlayer(supabase, playerId);
  const { data } = await supabase.from("mentor_messages").select(MESSAGE_COLUMNS).eq("player_id", player.id).order("created_at", { ascending: false }).limit(100);
  const messages = (data ?? []) as MentorMessage[];
  const photos = await signedMessagePhotoUrls(supabase, messages.map((m) => m.photo_path));
  const unread = messages.filter((m) => !m.read_at);
  return (
    <SectionShell title="Messages" subtitle={`From ${firstName(player)}'s mentors`}>
      <div className="flex flex-col gap-4">
        {access.isSelf && unread.length > 1 && (
          <div className="self-end">
            <GotIt playerId={player.id} ids={unread.map((m) => m.id)} label="Got them all" />
          </div>
        )}
        {messages.length === 0 ? (
          <EmptyState>No messages yet. When a mentor sends you something, it shows up here and at the top of your menu.</EmptyState>
        ) : (
          messages.map((m) => (
            <MessageCard key={m.id} message={m} photoUrl={m.photo_path ? (photos.get(m.photo_path) ?? null) : null} playerId={player.id} canDismiss={access.isSelf} />
          ))
        )}
        {!access.isSelf && <p className="text-xs text-muted">Coaches and admins can read every message a mentor sends.</p>}
      </div>
    </SectionShell>
  );
}
