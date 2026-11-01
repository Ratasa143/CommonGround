import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  ActorNameSchema,
  AllowedStatusTransitions,
  CorrelationIdSchema,
  EventNameSchema,
  IncidentStatusSchema,
  TriageProposalSchema,
  type ActorName,
  type EventName,
  type IncidentStatus,
  type TriageProposal,
} from "../../core/src/index.js";
import { withTransaction } from "../../db/src/index.js";

const STAFF = new Set<ActorName>(["maintenance_staff", "facilities_staff", "reviewer"]);

export class DomainError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_TRANSITION" | "CONFLICT") {
    super(message);
    this.name = "DomainError";
  }
}

function correlation(value?: string): string {
  return CorrelationIdSchema.parse(value ?? randomUUID());
}

function actor(value: string): ActorName {
  return ActorNameSchema.parse(value);
}

function eventName(value: string): EventName {
  return EventNameSchema.parse(value);
}

function transitionIsAllowed(from: IncidentStatus, to: IncidentStatus): boolean {
  return (AllowedStatusTransitions[from] as readonly IncidentStatus[]).includes(to);
}

function assertTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!transitionIsAllowed(from, to)) {
    throw new DomainError(`Transition ${from} -> ${to} is not allowed.`, "INVALID_TRANSITION");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Redacts supplied identity names plus common email, phone, and room-number forms.
 * Callers handling free text must pass names from structured identity data.
 */
export function redact(text: string, knownNames: readonly string[] = []): string {
  let output = text
    .replace(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/giu, "[EMAIL]")
    .replace(/(?<!\w)(?:\+?91[\s-]?)?[6-9](?:[\s().-]?\d){9}(?!\d)/gu, "[PHONE]")
    .replace(/\b(?:room|rm\.?)\s*(?:no\.?|#)?\s*[A-Z]?(?:[-/]?\d{1,4})[A-Z]?\b/giu, "[ROOM]");
  for (const name of [...knownNames].filter(Boolean).sort((a, b) => b.length - a.length)) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "giu"), "[NAME]");
  }
  return output;
}

async function insertOutbox(
  client: PoolClient,
  input: { aggregateId: string; event: EventName; correlationId: string; payload: Record<string, unknown> },
): Promise<void> {
  await client.query(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload, correlation_id)
     VALUES ('incident', $1, $2, $3::jsonb, $4)`,
    [input.aggregateId, input.event, JSON.stringify(input.payload), input.correlationId],
  );
}

async function insertStatusEvent(
  client: PoolClient,
  input: {
    incidentId: string;
    event: EventName;
    actor: ActorName;
    correlationId: string;
    from?: IncidentStatus | null;
    to?: IncidentStatus | null;
    reason?: string | null;
    knownNames?: readonly string[];
  },
): Promise<void> {
  await client.query(
    `INSERT INTO status_events
       (incident_id, event_name, from_status, to_status, reason, actor_type, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.incidentId, input.event, input.from ?? null, input.to ?? null,
      input.reason ? redact(input.reason, input.knownNames) : null, input.actor, input.correlationId],
  );
}

async function transitionIncident(
  client: PoolClient,
  input: {
    incidentId: string;
    from: IncidentStatus;
    to: IncidentStatus;
    event: EventName;
    actor: ActorName;
    correlationId: string;
    reason?: string;
    knownNames?: readonly string[];
  },
): Promise<void> {
  assertTransition(input.from, input.to);
  const locked = await client.query<{ status: string }>(
    "SELECT status FROM incidents WHERE id = $1 FOR UPDATE",
    [input.incidentId],
  );
  if (!locked.rowCount) throw new DomainError("Incident not found.", "NOT_FOUND");
  const current = IncidentStatusSchema.parse(locked.rows[0]!.status);
  if (current !== input.from) {
    throw new DomainError(`Expected ${input.from}; incident is ${current}.`, "CONFLICT");
  }

  const updated = await client.query(
    `UPDATE incidents
     SET status = $2, updated_at = now(),
         resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END
     WHERE id = $1 AND status = $3`,
    [input.incidentId, input.to, input.from],
  );
  if (updated.rowCount !== 1) throw new DomainError("Incident changed concurrently.", "CONFLICT");
  await insertStatusEvent(client, input);
  await insertOutbox(client, {
    aggregateId: input.incidentId,
    event: input.event,
    correlationId: input.correlationId,
    payload: {
      incidentId: input.incidentId,
      fromStatus: input.from,
      toStatus: input.to,
      actor: input.actor,
      reason: input.reason ? redact(input.reason, input.knownNames) : undefined,
      correlationId: input.correlationId,
    },
  });
}

export interface ReportGrievanceInput {
  locationId: string;
  summary: string;
  reportText: string;
  idempotencyKey: string;
  reporterRef?: string;
  knownNames?: string[];
  correlationId?: string;
}

export async function reportGrievance(
  pool: Pool,
  input: ReportGrievanceInput,
): Promise<{ incidentId: string; reportId: string; correlationId: string; reused: boolean }> {
  const correlationId = correlation(input.correlationId);
  const locationId = input.locationId.trim();
  const summary = redact(input.summary.trim(), input.knownNames);
  const reportText = input.reportText.trim();
  const key = input.idempotencyKey.trim();
  if (!locationId || !summary || !reportText || !key) throw new TypeError("Location, summary, report text, and idempotency key are required.");

  return withTransaction(pool, async (client) => {
    const prior = await client.query<{ id: string; incident_id: string }>(
      "SELECT id, incident_id FROM reports WHERE idempotency_key = $1",
      [key],
    );
    if (prior.rowCount) {
      return { incidentId: prior.rows[0]!.incident_id, reportId: prior.rows[0]!.id, correlationId, reused: true };
    }

    const createdIncident = await client.query<{ id: string }>(
      `INSERT INTO incidents (category, location_id, summary)
       VALUES ('wifi_outage', $1, $2)
       ON CONFLICT (category, location_id) WHERE status <> 'resolved' DO NOTHING
       RETURNING id`,
      [locationId, summary],
    );
    const incidentId = createdIncident.rows[0]?.id ?? (
      await client.query<{ id: string }>(
        `SELECT id FROM incidents
         WHERE category = 'wifi_outage' AND location_id = $1 AND status <> 'resolved'
         FOR UPDATE`,
        [locationId],
      )
    ).rows[0]?.id;
    if (!incidentId) throw new DomainError("Could not find or create an active incident.", "CONFLICT");

    const report = await client.query<{ id: string }>(
      `INSERT INTO reports (incident_id, idempotency_key, report_text, reporter_ref)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [incidentId, key, reportText, input.reporterRef ?? null],
    );
    if (!report.rowCount) {
      const existing = await client.query<{ id: string; incident_id: string }>(
        "SELECT id, incident_id FROM reports WHERE idempotency_key = $1",
        [key],
      );
      if (!existing.rowCount) throw new DomainError("Duplicate report is not yet visible.", "CONFLICT");
      if (createdIncident.rowCount) await client.query("DELETE FROM incidents WHERE id = $1", [incidentId]);
      return { incidentId: existing.rows[0]!.incident_id, reportId: existing.rows[0]!.id, correlationId, reused: true };
    }

    await insertStatusEvent(client, {
      incidentId,
      event: eventName("incident.reported"),
      actor: actor("student"),
      correlationId,
      to: "new",
      reason: summary,
      knownNames: input.knownNames,
    });
    await insertOutbox(client, {
      aggregateId: incidentId,
      event: eventName("incident.reported"),
      correlationId,
      payload: { incidentId, reportId: report.rows[0]!.id, correlationId },
    });
    return { incidentId, reportId: report.rows[0]!.id, correlationId, reused: false };
  });
}

export interface TriageInput {
  proposal: TriageProposal;
  knownNames?: string[];
  simulated?: boolean;
  correlationId?: string;
}

export async function proposeTriage(
  pool: Pool,
  input: TriageInput,
): Promise<{ incidentId: string; correlationId: string }> {
  const proposal = TriageProposalSchema.parse(input.proposal);
  const correlationId = correlation(input.correlationId);
  const safeProposal: TriageProposal = {
    ...proposal,
    summary: redact(proposal.summary, input.knownNames),
    reason: redact(proposal.reason, input.knownNames),
    recommendedStaffAction: redact(proposal.recommendedStaffAction, input.knownNames),
  };
  return withTransaction(pool, async (client) => {
    await transitionIncident(client, {
      incidentId: safeProposal.incidentId,
      from: "new",
      to: "triage_proposed",
      event: eventName("incident.triage_proposed"),
      actor: actor("triage_agent"),
      correlationId,
      reason: safeProposal.reason,
      knownNames: input.knownNames,
    });
    await client.query("UPDATE incidents SET eta_minutes = $2 WHERE id = $1", [safeProposal.incidentId, safeProposal.suggestedEtaMinutes]);
    await client.query(
      `UPDATE outbox SET payload = payload || $2::jsonb
       WHERE correlation_id = $1 AND event_type = 'incident.triage_proposed'`,
      [correlationId, JSON.stringify({ proposal: safeProposal, simulated: input.simulated ?? false })],
    );
    return { incidentId: safeProposal.incidentId, correlationId };
  });
}

export interface IncidentTextInput {
  incidentId: string;
  actor: ActorName;
  text: string;
  knownNames?: string[];
  correlationId?: string;
}

async function postTextEvent(
  pool: Pool,
  input: IncidentTextInput,
  event: EventName,
  allowedActors: ReadonlySet<ActorName>,
): Promise<{ incidentId: string; correlationId: string }> {
  const actorName = actor(input.actor);
  if (!allowedActors.has(actorName)) throw new DomainError("Actor cannot post this update.", "FORBIDDEN");
  const safeText = redact(input.text, input.knownNames);
  const correlationId = correlation(input.correlationId);
  return withTransaction(pool, async (client) => {
    const incident = await client.query("SELECT id FROM incidents WHERE id = $1 FOR UPDATE", [input.incidentId]);
    if (!incident.rowCount) throw new DomainError("Incident not found.", "NOT_FOUND");
    await insertStatusEvent(client, {
      incidentId: input.incidentId,
      event,
      actor: actorName,
      correlationId,
      reason: safeText,
      knownNames: input.knownNames,
    });
    await insertOutbox(client, {
      aggregateId: input.incidentId,
      event,
      correlationId,
      payload: { incidentId: input.incidentId, text: safeText, actor: actorName, correlationId },
    });
    return { incidentId: input.incidentId, correlationId };
  });
}

export function postStaffUpdate(pool: Pool, input: IncidentTextInput) {
  return postTextEvent(pool, input, eventName("staff.update_posted"), STAFF);
}

export function postFacilitiesNotice(pool: Pool, input: IncidentTextInput) {
  return postTextEvent(pool, input, eventName("facilities.notice_posted"), new Set(["facilities_staff"]));
}

export interface ProposalDecisionInput {
  incidentId: string;
  approverRef: string;
  actor: ActorName;
  reason?: string;
  knownNames?: string[];
  correlationId?: string;
}

async function decideProposal(
  pool: Pool,
  input: ProposalDecisionInput,
  decision: "approved" | "rejected",
): Promise<{ incidentId: string; status: IncidentStatus; correlationId: string }> {
  const actorName = actor(input.actor);
  if (!STAFF.has(actorName)) throw new DomainError("Only staff may decide a triage proposal.", "FORBIDDEN");
  if (!input.approverRef.trim()) throw new TypeError("Approver reference is required.");
  const correlationId = correlation(input.correlationId);
  const safeReason = input.reason ? redact(input.reason, input.knownNames) : null;
  const nextStatus: IncidentStatus = decision === "approved" ? "in_progress" : "new";
  const event = eventName(decision === "approved" ? "proposal.approved" : "proposal.rejected");

  return withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO human_approvals (subject_type, subject_id, approver_ref, decision, reason)
       VALUES ('triage_proposal', $1, $2, $3, $4)`,
      [input.incidentId, input.approverRef, decision, safeReason],
    );
    await transitionIncident(client, {
      incidentId: input.incidentId,
      from: "triage_proposed",
      to: nextStatus,
      event,
      actor: actorName,
      correlationId,
      reason: safeReason ?? undefined,
      knownNames: input.knownNames,
    });
    return { incidentId: input.incidentId, status: nextStatus, correlationId };
  });
}

export function approveProposal(pool: Pool, input: ProposalDecisionInput) {
  return decideProposal(pool, input, "approved");
}

export function rejectProposal(pool: Pool, input: ProposalDecisionInput) {
  return decideProposal(pool, input, "rejected");
}

export interface StaffActionInput {
  incidentId: string;
  actor: ActorName;
  reason?: string;
  knownNames?: string[];
  correlationId?: string;
}

export async function confirmFix(
  pool: Pool,
  input: StaffActionInput,
): Promise<{ incidentId: string; status: "fix_applied"; correlationId: string }> {
  const actorName = actor(input.actor);
  if (!STAFF.has(actorName)) throw new DomainError("Only staff may confirm a fix.", "FORBIDDEN");
  const correlationId = correlation(input.correlationId);
  await withTransaction(pool, (client) => transitionIncident(client, {
    incidentId: input.incidentId,
    from: "in_progress",
    to: "fix_applied",
    event: eventName("fix.confirmed"),
    actor: actorName,
    correlationId,
    reason: input.reason ? redact(input.reason, input.knownNames) : undefined,
    knownNames: input.knownNames,
  }));
  return { incidentId: input.incidentId, status: "fix_applied", correlationId };
}

export async function resolveIncident(
  pool: Pool,
  input: StaffActionInput,
): Promise<{ incidentId: string; status: "resolved"; correlationId: string }> {
  const actorName = actor(input.actor);
  if (!STAFF.has(actorName)) throw new DomainError("Only staff may resolve an incident.", "FORBIDDEN");
  const correlationId = correlation(input.correlationId);
  await withTransaction(pool, (client) => transitionIncident(client, {
    incidentId: input.incidentId,
    from: "fix_applied",
    to: "resolved",
    event: eventName("incident.status_changed"),
    actor: actorName,
    correlationId,
    reason: input.reason ? redact(input.reason, input.knownNames) : undefined,
    knownNames: input.knownNames,
  }));
  return { incidentId: input.incidentId, status: "resolved", correlationId };
}

export async function reportFixFailure(
  pool: Pool,
  input: StaffActionInput,
): Promise<{ incidentId: string; status: "in_progress"; correlationId: string }> {
  const actorName = actor(input.actor);
  if (actorName !== "student") throw new DomainError("Only the reporting resident may report a failed fix.", "FORBIDDEN");
  const correlationId = correlation(input.correlationId);
  await withTransaction(pool, (client) => transitionIncident(client, {
    incidentId: input.incidentId,
    from: "fix_applied",
    to: "in_progress",
    event: eventName("incident.status_changed"),
    actor: actorName,
    correlationId,
    reason: input.reason ? redact(input.reason, input.knownNames) : undefined,
    knownNames: input.knownNames,
  }));
  return { incidentId: input.incidentId, status: "in_progress", correlationId };
}
