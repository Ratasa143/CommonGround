import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { z } from "zod";
import { createPool } from "../../../packages/db/src/index.js";
import { MekoGateway, mekoConfigFromEnvironment } from "../../../packages/meko/src/index.js";
import {
  approveProposal,
  confirmFix,
  DomainError,
  postFacilitiesNotice,
  postStaffUpdate,
  proposeTriage,
  rejectProposal,
  reportFixFailure,
  reportGrievance,
  resolveIncident,
} from "../../../packages/domain/src/index.js";
import { campusLocations, campusStudySpaces } from "../../../seed/campus.js";

export const demoPersonas = {
  "student-a": { id: "00000000-0000-4000-8000-000000000001", actor: "student", name: "Student A" },
  "student-b": { id: "00000000-0000-4000-8000-000000000002", actor: "student", name: "Student B" },
  maintenance: { id: "00000000-0000-4000-8000-000000000003", actor: "maintenance_staff", name: "Maintenance Staff" },
  facilities: { id: "00000000-0000-4000-8000-000000000004", actor: "facilities_staff", name: "Facilities Staff" },
  reviewer: { id: "00000000-0000-4000-8000-000000000005", actor: "reviewer", name: "Reviewer" },
} as const;

type PersonaKey = keyof typeof demoPersonas;
type Persona = (typeof demoPersonas)[PersonaKey];
type Actor = Persona["actor"];

const ReportBody = z.object({
  locationId: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(240),
  reportText: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();

const TextBody = z.object({ text: z.string().trim().min(1).max(2000) }).strict();
const DecisionBody = z.object({ reason: z.string().trim().max(500).optional() }).strict();

function personaFor(request: FastifyRequest, queryPersona?: string): Persona {
  const header = request.headers["x-demo-persona"];
  const key = (Array.isArray(header) ? header[0] : header) ?? queryPersona ?? "student-a";
  if (!Object.hasOwn(demoPersonas, key)) throw new DomainError("Unknown demo persona.", "FORBIDDEN");
  return demoPersonas[key as PersonaKey];
}

function requireActor(persona: Persona, ...allowed: Actor[]): void {
  if (!allowed.includes(persona.actor)) throw new DomainError("This demo persona cannot perform that action.", "FORBIDDEN");
}

function lastEventCursor(value: string | undefined): { time: string; id: string } | undefined {
  if (!value) return undefined;
  const separator = value.lastIndexOf("|");
  if (separator < 1) return undefined;
  const time = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!Number.isFinite(Date.parse(time)) || !z.string().uuid().safeParse(id).success) return undefined;
  return { time, id };
}

export async function buildApp(pool = createPool(), options: { logger?: boolean; meko?: MekoGateway } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const meko = options.meko ?? new MekoGateway(pool, mekoConfigFromEnvironment());

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: "INVALID_REQUEST", details: error.issues });
    if (error instanceof DomainError) {
      const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/meko/status", async () => meko.getStatus());
  app.post("/meko/preview-check", async (request, reply) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff", "reviewer");
    const status = meko.getStatus();
    if (!status.triageReady) return reply.code(503).send({
      error: "MEKO_SETUP_REQUIRED",
      message: "Add the dedicated product Triage token, agent ID, and datapack ID to Alchemy's local .env, then restart the API.",
    });
    try {
      const mekoRequest = { correlationId: randomUUID(), simulated: status.simulated };
      const conversation = await meko.triage.openConversation(mekoRequest, "CommonGround synthetic connection check", randomUUID());
      const recall = await meko.triage.recall(mekoRequest, conversation.conversationId, "triage",
        "Synthetic evaluator check only: return approved, non-identifying campus Wi-Fi outage repair guidance. No live incident or student data is included.");
      return { ok: true, mode: status.mode, simulated: recall.simulated, calls: conversation.callCount + recall.callCount, responseReceived: recall.result !== undefined };
    } catch {
      return reply.code(503).send({ error: "MEKO_UNAVAILABLE", message: "Meko did not return a response. Check the product token, datapack access and MCP URL." });
    }
  });
  app.get("/demo/personas", async () => Object.entries(demoPersonas).map(([key, value]) => ({ key, actor: value.actor, name: value.name })));
  app.get("/locations", async () => ({ locations: campusLocations, studySpaces: campusStudySpaces }));

  app.post<{ Body: z.infer<typeof ReportBody> }>("/reports", async (request, reply) => {
    const persona = personaFor(request);
    requireActor(persona, "student");
    const input = ReportBody.parse(request.body);
    const result = await reportGrievance(pool, {
      ...input,
      reporterRef: persona.id,
      knownNames: [persona.name],
    });
    return reply.code(result.reused ? 200 : 201).send({ ...result, status: "new" });
  });

  app.get("/my/reports", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "student");
    const result = await pool.query(
      `SELECT i.id, i.category, i.location_id AS "locationId", i.status, i.summary,
              i.eta_minutes AS "etaMinutes", i.created_at AS "createdAt"
       FROM incidents i
       WHERE EXISTS (
         SELECT 1 FROM reports r WHERE r.incident_id = i.id AND r.reporter_ref = $1
       )
       ORDER BY i.created_at DESC LIMIT 100`,
      [persona.id],
    );
    return { incidents: result.rows };
  });

  app.get<{ Params: { id: string } }>("/incidents/:id", async (request) => {
    const persona = personaFor(request);
    const incident = await pool.query(
      `SELECT i.id, i.category, i.location_id AS "locationId", i.status, i.summary,
              i.eta_minutes AS "etaMinutes", i.created_at AS "createdAt", i.updated_at AS "updatedAt",
              (SELECT COUNT(*)::int FROM reports r WHERE r.incident_id = i.id) AS "reportCount"
       FROM incidents i WHERE i.id = $1`,
      [request.params.id],
    );
    if (!incident.rowCount) throw new DomainError("Incident not found.", "NOT_FOUND");
    if (persona.actor === "student") {
      const ownership = await pool.query(
        "SELECT 1 FROM reports WHERE incident_id = $1 AND reporter_ref = $2 LIMIT 1",
        [request.params.id, persona.id],
      );
      if (!ownership.rowCount) throw new DomainError("This report is not available to this student.", "FORBIDDEN");
    }
    const reports = await pool.query(
      `SELECT id, report_text AS "reportText", created_at AS "createdAt"
       FROM reports WHERE incident_id = $1 AND ($2::uuid IS NULL OR reporter_ref = $2)
       ORDER BY created_at ASC`,
      [request.params.id, persona.actor === "student" ? persona.id : null],
    );
    const events = await pool.query(
      `SELECT id, event_name AS "eventName", from_status AS "fromStatus", to_status AS "toStatus",
              reason, actor_type AS "actorType", created_at AS "createdAt"
       FROM status_events WHERE incident_id = $1 ORDER BY created_at ASC, id ASC`,
      [request.params.id],
    );
    return { incident: incident.rows[0], reports: reports.rows, events: events.rows };
  });

  app.get("/staff/queue", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff", "facilities_staff", "reviewer");
    const result = await pool.query(
      `SELECT i.id, i.category, i.location_id AS "locationId", i.status, i.summary,
              i.eta_minutes AS "etaMinutes", i.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM reports r WHERE r.incident_id = i.id) AS "reportCount",
              (SELECT o.payload FROM outbox o
               WHERE o.aggregate_id = i.id AND o.event_type = 'incident.triage_proposed'
               ORDER BY o.created_at DESC LIMIT 1) AS proposal
       FROM incidents i WHERE i.status <> 'resolved'
       ORDER BY i.created_at DESC LIMIT 100`,
    );
    return { incidents: result.rows };
  });

  app.post<{ Params: { id: string } }>("/incidents/:id/demo-triage", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff", "reviewer");
    const incident = await pool.query<{ id: string; summary: string }>(
      "SELECT id, summary FROM incidents WHERE id = $1",
      [request.params.id],
    );
    if (!incident.rowCount) throw new DomainError("Incident not found.", "NOT_FOUND");
    const result = await proposeTriage(pool, {
      proposal: {
        incidentId: request.params.id,
        category: "wifi_outage",
        proposedStatus: "triage_proposed",
        summary: "Wi-Fi outage needs staff verification",
        reason: "A deterministic demo proposal was generated without Meko or a model.",
        suggestedEtaMinutes: 30,
        recommendedStaffAction: "Check the nearest access point and post an update.",
      },
      simulated: true,
    });
    return { ...result, simulated: true };
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof TextBody> }>("/incidents/:id/staff-updates", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff");
    const body = TextBody.parse(request.body);
    return postStaffUpdate(pool, {
      incidentId: request.params.id,
      actor: "maintenance_staff",
      text: body.text,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof TextBody> }>("/incidents/:id/facilities-notices", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "facilities_staff");
    const body = TextBody.parse(request.body);
    return postFacilitiesNotice(pool, {
      incidentId: request.params.id,
      actor: "facilities_staff",
      text: body.text,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof DecisionBody> }>("/incidents/:id/proposal/approve", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "reviewer");
    const body = DecisionBody.parse(request.body ?? {});
    return approveProposal(pool, {
      incidentId: request.params.id,
      approverRef: persona.id,
      actor: "reviewer",
      reason: body.reason,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof DecisionBody> }>("/incidents/:id/proposal/reject", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "reviewer");
    const body = DecisionBody.parse(request.body ?? {});
    return rejectProposal(pool, {
      incidentId: request.params.id,
      approverRef: persona.id,
      actor: "reviewer",
      reason: body.reason,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof DecisionBody> }>("/incidents/:id/confirm-fix", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff");
    const body = DecisionBody.parse(request.body ?? {});
    return confirmFix(pool, {
      incidentId: request.params.id,
      actor: "maintenance_staff",
      reason: body.reason,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof DecisionBody> }>("/incidents/:id/resolve", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "maintenance_staff");
    const body = DecisionBody.parse(request.body ?? {});
    return resolveIncident(pool, {
      incidentId: request.params.id,
      actor: "maintenance_staff",
      reason: body.reason,
      knownNames: [persona.name],
    });
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof DecisionBody> }>("/incidents/:id/report-failure", async (request) => {
    const persona = personaFor(request);
    requireActor(persona, "student");
    const ownership = await pool.query(
      "SELECT 1 FROM reports WHERE incident_id = $1 AND reporter_ref = $2 LIMIT 1",
      [request.params.id, persona.id],
    );
    if (!ownership.rowCount) throw new DomainError("This report is not available to this student.", "FORBIDDEN");
    const body = DecisionBody.parse(request.body ?? {});
    return reportFixFailure(pool, {
      incidentId: request.params.id,
      actor: "student",
      reason: body.reason,
      knownNames: [persona.name],
    });
  });

  app.get<{ Params: { id: string }; Querystring: { persona?: string } }>("/incidents/:id/events", async (request, reply) => {
    const persona = personaFor(request, request.query.persona);
    const exists = await pool.query("SELECT id FROM incidents WHERE id = $1", [request.params.id]);
    if (!exists.rowCount) throw new DomainError("Incident not found.", "NOT_FOUND");
    if (persona.actor === "student") {
      const own = await pool.query("SELECT 1 FROM reports WHERE incident_id = $1 AND reporter_ref = $2", [request.params.id, persona.id]);
      if (!own.rowCount) throw new DomainError("This report is not available to this student.", "FORBIDDEN");
    }
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let closed = false;
    let cursor = lastEventCursor(request.headers["last-event-id"] as string | undefined);
    reply.raw.on("close", () => { closed = true; });
    try {
      while (!closed) {
        const rows = await pool.query<{
          id: string; event_name: string; to_status: string | null; reason: string | null; created_at: string;
        }>(
          `SELECT id, event_name, to_status, reason, created_at::text AS created_at
           FROM status_events
           WHERE incident_id = $1
             AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::uuid))
           ORDER BY created_at ASC, id ASC LIMIT 100`,
          [request.params.id, cursor?.time ?? null, cursor?.id ?? null],
        );
        for (const row of rows.rows) {
          const time = row.created_at;
          const id = `${time}|${row.id}`;
          reply.raw.write(`id: ${id}\nevent: ${row.event_name}\ndata: ${JSON.stringify({ eventName: row.event_name, status: row.to_status, reason: row.reason, createdAt: new Date(time).toISOString() })}\n\n`);
          cursor = { time, id: row.id };
        }
        if (rows.rowCount === 0) reply.raw.write(": keep-alive\n\n");
        await delay(1000);
      }
    } catch (error) {
      if (!closed) app.log.error(error);
    } finally {
      if (!reply.raw.destroyed) reply.raw.end();
    }
  });

  return app;
}
