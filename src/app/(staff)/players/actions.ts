"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { editorCheck } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allOf, checkbox, friendlyDbError, oneOf, text, wholeNumber, type FormState } from "@/lib/form";
import { BATS, POSITIONS, THROWS, isUuid } from "@/lib/softball";

function playerFields(fd: FormData) {
  const grad_year = wholeNumber(fd, "grad_year", 2000, 2100);
  const primary_position = oneOf(fd, "primary_position", POSITIONS);
  return {
    grad_year,
    values: {
      first_name: text(fd, "first_name"),
      last_name: text(fd, "last_name"),
      preferred_name: text(fd, "preferred_name"),
      bats: oneOf(fd, "bats", BATS),
      throws: oneOf(fd, "throws", THROWS),
      primary_position,
      // the primary position doesn't need repeating as a secondary one
      secondary_positions: allOf(fd, "secondary_positions", POSITIONS).filter((p) => p !== primary_position),
      is_slapper: checkbox(fd, "is_slapper"),
      notes: text(fd, "notes"),
    },
  };
}

function validate(fields: ReturnType<typeof playerFields>): string | null {
  if (!fields.values.first_name || !fields.values.last_name) return "Enter the player's first and last name.";
  if (fields.grad_year === "invalid") return "Grad year should be a year like 2030.";
  return null;
}

export async function createPlayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const fields = playerFields(fd);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .insert({ ...fields.values, grad_year: fields.grad_year })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error) };

  redirect(`/players/${data.id}`);
}

export async function updatePlayer(_prev: FormState, fd: FormData): Promise<FormState> {
  const denied = await editorCheck();
  if (denied) return { error: denied };

  const id = text(fd, "id");
  if (!isUuid(id)) return { error: "Unknown player." };
  const fields = playerFields(fd);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update({ ...fields.values, grad_year: fields.grad_year })
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "That player no longer exists, or you can't edit them." };

  refresh();
  return { error: null, saved: true };
}
