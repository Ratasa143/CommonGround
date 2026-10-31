import { z } from "zod";

export const IncidentStatusSchema = z.enum([
  "new",
  "triage_proposed",
  "in_progress",
  "fix_applied",
  "resolved",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const AllowedStatusTransitions = {
  new: ["triage_proposed"],
  triage_proposed: ["new", "in_progress"],
  in_progress: ["fix_applied"],
  fix_applied: ["in_progress", "resolved"],
  resolved: [],
} as const satisfies Record<IncidentStatus, readonly IncidentStatus[]>;

export const EventNameSchema = z.enum([
  "incident.reported",
  "incident.triage_proposed",
  "incident.status_changed",
  "staff.update_posted",
  "facilities.notice_posted",
  "proposal.approved",
  "proposal.rejected",
  "fix.confirmed",
  "bridge.requested",
  "bridge.member_joined",
  "bridge.offer_created",
  "bridge.left",
  "bridge.expired",
]);
export type EventName = z.infer<typeof EventNameSchema>;

export const ProductDatapackNameSchema = z.enum([
  "cg-triage",
  "cg-bridge",
  "cg-commons",
]);
export type ProductDatapackName = z.infer<typeof ProductDatapackNameSchema>;

export const BuildDatapackNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-build$/, "Expected a team build datapack name");

export const ActorNameSchema = z.enum([
  "student",
  "maintenance_staff",
  "facilities_staff",
  "reviewer",
  "triage_agent",
  "bridge_steward",
  "curator",
  "approval_service",
]);
export type ActorName = z.infer<typeof ActorNameSchema>;

export const CorrelationIdSchema = z.string().uuid();
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

const NonEmptyText = (max: number) => z.string().trim().min(1).max(max);

export const TriageProposalSchema = z
  .object({
    incidentId: CorrelationIdSchema,
    category: z.literal("wifi_outage"),
    proposedStatus: z.literal("triage_proposed"),
    summary: NonEmptyText(240),
    reason: NonEmptyText(500),
    suggestedEtaMinutes: z.number().int().min(0).max(10_080).nullable(),
    recommendedStaffAction: NonEmptyText(240),
  })
  .strict();
export type TriageProposal = z.infer<typeof TriageProposalSchema>;

export const LessonDraftSchema = z
  .object({
    sourceIncidentId: CorrelationIdSchema,
    title: NonEmptyText(120),
    lesson: NonEmptyText(500),
    whenApplicable: NonEmptyText(240),
    recommendedStaffAction: NonEmptyText(240),
  })
  .strict();
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

export const BridgeHandoffSchema = z
  .object({
    consentId: CorrelationIdSchema,
    locationId: NonEmptyText(120),
    windowStart: z.string().datetime(),
    windowEnd: z.string().datetime(),
    supportType: z.literal("study_company"),
  })
  .strict();
export type BridgeHandoff = z.infer<typeof BridgeHandoffSchema>;
