import type { SupabaseClient } from "@supabase/supabase-js";
import type { Actor } from "./server-auth";

type AuditInput = {
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string | null;
  detail?: Record<string, unknown>;
};

export async function writeAuditLog(
  supabase: SupabaseClient,
  input: AuditInput,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: input.actor.id,
    actor_email: input.actor.email,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    detail: input.detail ?? {},
  });

  if (error) {
    // Keep main action successful even if audit insert fails.
    console.error("Audit log insert failed:", error.message);
  }
}

