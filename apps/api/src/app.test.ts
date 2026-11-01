import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { applyInitialMigration, createPool } from "../../../packages/db/src/index.js";
import { buildApp } from "./app.js";

const enabled = Boolean(process.env.YB_URL);
const pool = enabled ? createPool() : null;
const db = () => {
  if (!pool) throw new Error("Set YB_URL to run API integration tests.");
  return pool;
};
const appPromise = pool ? buildApp(pool, { logger: false }) : null;
const app = async () => {
  if (!appPromise) throw new Error("Set YB_URL to run API integration tests.");
  return appPromise;
};
const createdIncidents: string[] = [];

before(async () => {
  if (!pool) return;
  const sql = await readFile(new URL("../../../packages/db/migrations/001_initial.sql", import.meta.url), "utf8");
  await applyInitialMigration(pool, sql);
  await (await app()).ready();
});

after(async () => {
  if (pool && createdIncidents.length) {
    await pool.query("DELETE FROM outbox WHERE aggregate_id = ANY($1::uuid[])", [createdIncidents]);
    await pool.query("DELETE FROM human_approvals WHERE subject_id = ANY($1::uuid[])", [createdIncidents]);
    await pool.query("DELETE FROM incidents WHERE id = ANY($1::uuid[])", [createdIncidents]);
  }
  if (appPromise) await (await appPromise).close();
  await pool?.end();
});

function reportBody() {
  return {
    locationId: `api-test-${randomUUID()}`,
    summary: "Synthetic Wi-Fi outage",
    reportText: "Synthetic API integration fixture; not a live report.",
    idempotencyKey: randomUUID(),
  };
}

test("HTTP report route deduplicates 50 concurrent identical submissions", { skip: !enabled }, async () => {
  const server = await app();
  const body = reportBody();
  const responses = await Promise.all(Array.from({ length: 50 }, () => server.inject({
    method: "POST",
    url: "/reports",
    headers: { "x-demo-persona": "student-a" },
    payload: body,
  })));
  for (const response of responses) assert.ok([200, 201].includes(response.statusCode));
  const values = responses.map((response) => response.json<{ incidentId: string; reportId: string }>());
  const incidentIds = new Set(values.map((value) => value.incidentId));
  const reportIds = new Set(values.map((value) => value.reportId));
  assert.equal(incidentIds.size, 1);
  assert.equal(reportIds.size, 1);
  const incidentId = values[0]!.incidentId;
  createdIncidents.push(incidentId);
  const counts = await db().query<{ incidents: string; reports: string; events: string }>(
    `SELECT (SELECT count(*) FROM incidents WHERE id = $1) AS incidents,
            (SELECT count(*) FROM reports WHERE idempotency_key = $2) AS reports,
            (SELECT count(*) FROM outbox WHERE aggregate_id = $1 AND event_type = 'incident.reported') AS events`,
    [incidentId, body.idempotencyKey],
  );
  assert.deepEqual(counts.rows[0], { incidents: "1", reports: "1", events: "1" });
});

test("student report access is isolated and staff queue is role-checked", { skip: !enabled }, async () => {
  const server = await app();
  const created = await server.inject({
    method: "POST", url: "/reports", headers: { "x-demo-persona": "student-a" }, payload: reportBody(),
  });
  assert.equal(created.statusCode, 201);
  const { incidentId } = created.json<{ incidentId: string }>();
  createdIncidents.push(incidentId);
  const otherStudent = await server.inject({ method: "GET", url: `/incidents/${incidentId}`, headers: { "x-demo-persona": "student-b" } });
  const owner = await server.inject({ method: "GET", url: `/incidents/${incidentId}`, headers: { "x-demo-persona": "student-a" } });
  const forbiddenQueue = await server.inject({ method: "GET", url: "/staff/queue", headers: { "x-demo-persona": "student-a" } });
  const staffQueue = await server.inject({ method: "GET", url: "/staff/queue", headers: { "x-demo-persona": "maintenance" } });
  const ownReports = await server.inject({ method: "GET", url: "/my/reports", headers: { "x-demo-persona": "student-a" } });
  const otherReports = await server.inject({ method: "GET", url: "/my/reports", headers: { "x-demo-persona": "student-b" } });
  const staffReports = await server.inject({ method: "GET", url: "/my/reports", headers: { "x-demo-persona": "maintenance" } });
  assert.equal(otherStudent.statusCode, 403);
  assert.equal(owner.statusCode, 200);
  assert.equal(forbiddenQueue.statusCode, 403);
  assert.equal(staffQueue.statusCode, 200);
  assert.equal(ownReports.statusCode, 200);
  assert.ok(ownReports.json<{ incidents: Array<{ id: string }> }>().incidents.some((incident) => incident.id === incidentId));
  assert.equal(otherReports.json<{ incidents: Array<{ id: string }> }>().incidents.some((incident) => incident.id === incidentId), false);
  assert.equal(staffReports.statusCode, 403);

});

test("simulated manual flow persists staff approval and fix status", { skip: !enabled }, async () => {
  const server = await app();
  const created = await server.inject({
    method: "POST", url: "/reports", headers: { "x-demo-persona": "student-a" }, payload: reportBody(),
  });
  const { incidentId } = created.json<{ incidentId: string }>();
  createdIncidents.push(incidentId);
  const proposal = await server.inject({ method: "POST", url: `/incidents/${incidentId}/demo-triage`, headers: { "x-demo-persona": "maintenance" }, payload: {} });
  const approval = await server.inject({ method: "POST", url: `/incidents/${incidentId}/proposal/approve`, headers: { "x-demo-persona": "reviewer" }, payload: {} });
  const fix = await server.inject({ method: "POST", url: `/incidents/${incidentId}/confirm-fix`, headers: { "x-demo-persona": "maintenance" }, payload: {} });
  const resolve = await server.inject({ method: "POST", url: `/incidents/${incidentId}/resolve`, headers: { "x-demo-persona": "maintenance" }, payload: {} });
  assert.equal(proposal.statusCode, 200);
  assert.equal(proposal.json<{ simulated: boolean }>().simulated, true);
  assert.equal(approval.statusCode, 200);
  assert.equal(fix.json<{ status: string }>().status, "fix_applied");
  assert.equal(resolve.json<{ status: string }>().status, "resolved");
});

test("SSE resumes strictly after Last-Event-ID", { skip: !enabled }, async () => {
  const server = await app();
  const created = await server.inject({
    method: "POST", url: "/reports", headers: { "x-demo-persona": "student-a" }, payload: reportBody(),
  });
  const { incidentId } = created.json<{ incidentId: string }>();
  createdIncidents.push(incidentId);
  const earlier = await db().query<{ id: string; cursor_time: string }>(
    "SELECT id, created_at::text AS cursor_time FROM status_events WHERE incident_id = $1 ORDER BY created_at ASC, id ASC LIMIT 1",
    [incidentId],
  );
  const cursor = `${earlier.rows[0]!.cursor_time}|${earlier.rows[0]!.id}`;
  await server.inject({
    method: "POST",
    url: `/incidents/${incidentId}/staff-updates`,
    headers: { "x-demo-persona": "maintenance" },
    payload: { text: "Synthetic staff update for SSE resume check." },
  });

  const address = await server.listen({ host: "127.0.0.1", port: 0 });
  const controller = new AbortController();
  const response = await fetch(`${address}/incidents/${incidentId}/events?persona=student-a`, {
    headers: { "Last-Event-ID": cursor },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  const chunk = await reader.read();
  const eventText = new TextDecoder().decode(chunk.value);
  controller.abort();
  await reader.cancel().catch(() => undefined);
  assert.match(eventText, /staff\.update_posted/);
  assert.doesNotMatch(eventText, /incident\.reported/);
});
