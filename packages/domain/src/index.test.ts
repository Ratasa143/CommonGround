import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { createPool } from "../../db/src/index.js";
import {
  approveProposal,
  confirmFix,
  postFacilitiesNotice,
  postStaffUpdate,
  proposeTriage,
  redact,
  rejectProposal,
  reportFixFailure,
  reportGrievance,
  resolveIncident,
  type ReportGrievanceInput,
} from "./index.js";

const enabled = Boolean(process.env.YB_URL);
const pool = enabled ? createPool() : null;
const db = () => {
  if (!pool) throw new Error("Set YB_URL to run domain integration tests.");
  return pool;
};

before(async () => {
  if (!pool) return;
  const migration = await readFile(new URL("../../db/migrations/001_initial.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const result = await client.query("SELECT version FROM schema_migrations WHERE version = '001_initial'");
    if (!result.rowCount) {
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations(version) VALUES ('001_initial') ON CONFLICT (version) DO NOTHING");
    }
  } finally {
    client.release();
  }
});

after(async () => pool?.end());

async function createIncident(label: string): Promise<string> {
  const input: ReportGrievanceInput = {
    locationId: `domain-test-${label}-${randomUUID()}`,
    summary: "Synthetic Wi-Fi test report",
    reportText: "Synthetic integration fixture only.",
    idempotencyKey: randomUUID(),
  };
  return (await reportGrievance(db(), input)).incidentId;
}

async function cleanup(incidentId: string): Promise<void> {
  await db().query("DELETE FROM outbox WHERE aggregate_id = $1", [incidentId]);
  await db().query("DELETE FROM human_approvals WHERE subject_id = $1", [incidentId]);
  await db().query("DELETE FROM incidents WHERE id = $1", [incidentId]);
}

const proposal = (incidentId: string) => ({
  incidentId,
  category: "wifi_outage" as const,
  proposedStatus: "triage_proposed" as const,
  summary: "Wi-Fi outage reported",
  reason: "Several synthetic reports describe a connection outage.",
  suggestedEtaMinutes: 30,
  recommendedStaffAction: "Check the access point.",
});

test("redact masks known names, phone numbers, emails, and room identifiers", () => {
  const source = "Asha reported +91 98765 43210 at asha@example.edu from Room 402.";
  const result = redact(source, ["Asha"]);
  assert.match(result, /\[NAME\]/);
  assert.match(result, /\[PHONE\]/);
  assert.match(result, /\[EMAIL\]/);
  assert.match(result, /\[ROOM\]/);
  assert.doesNotMatch(result, /Asha|98765|asha@example\.edu|Room 402/);
});

test("50 identical concurrent reports create one incident, report, and outbox event", { skip: !enabled }, async () => {
  const input: ReportGrievanceInput = {
    locationId: `domain-test-duplicates-${randomUUID()}`,
    summary: "Synthetic duplicate report",
    reportText: "Synthetic fixture; not a live report.",
    idempotencyKey: randomUUID(),
  };
  const results = await Promise.all(Array.from({ length: 50 }, () => reportGrievance(db(), input)));
  const incidentIds = new Set(results.map((result) => result.incidentId));
  const reportIds = new Set(results.map((result) => result.reportId));
  const incidentId = results[0]!.incidentId;
  try {
    assert.equal(incidentIds.size, 1);
    assert.equal(reportIds.size, 1);
    const counts = await db().query<{ reports: string; outbox: string }>(
      `SELECT (SELECT count(*) FROM reports WHERE idempotency_key = $1) AS reports,
              (SELECT count(*) FROM outbox WHERE aggregate_id = $2 AND event_type = 'incident.reported') AS outbox`,
      [input.idempotencyKey, incidentId],
    );
    assert.equal(Number(counts.rows[0]!.reports), 1);
    assert.equal(Number(counts.rows[0]!.outbox), 1);
  } finally {
    await cleanup(incidentId);
  }
});

test("triage, staff approval, fix, resident failure, and resolution follow allowed transitions", { skip: !enabled }, async () => {
  const incidentId = await createIncident("flow");
  try {
    await proposeTriage(db(), { proposal: proposal(incidentId) });
    await assert.rejects(
      approveProposal(db(), { incidentId, actor: "triage_agent", approverRef: "synthetic-agent" }),
      { code: "FORBIDDEN" },
    );
    await approveProposal(db(), { incidentId, actor: "reviewer", approverRef: "synthetic-reviewer" });
    await confirmFix(db(), { incidentId, actor: "maintenance_staff" });
    await reportFixFailure(db(), { incidentId, actor: "student", reason: "The synthetic connection still drops." });
    await confirmFix(db(), { incidentId, actor: "facilities_staff" });
    await resolveIncident(db(), { incidentId, actor: "maintenance_staff" });
    const final = await db().query<{ status: string }>("SELECT status FROM incidents WHERE id = $1", [incidentId]);
    assert.equal(final.rows[0]!.status, "resolved");
    const transitions = await db().query<{ from_status: string | null; to_status: string | null }>(
      "SELECT from_status, to_status FROM status_events WHERE incident_id = $1 AND to_status IS NOT NULL ORDER BY created_at, id",
      [incidentId],
    );
    assert.ok(transitions.rows.some((row) => row.from_status === "new" && row.to_status === "triage_proposed"));
    assert.ok(transitions.rows.some((row) => row.from_status === "triage_proposed" && row.to_status === "in_progress"));
    assert.ok(transitions.rows.some((row) => row.from_status === "fix_applied" && row.to_status === "in_progress"));
    assert.ok(transitions.rows.some((row) => row.from_status === "fix_applied" && row.to_status === "resolved"));
  } finally {
    await cleanup(incidentId);
  }
});

test("staff updates are redacted before event/outbox storage and facilities role is enforced", { skip: !enabled }, async () => {
  const incidentId = await createIncident("redaction");
  const correlationId = randomUUID();
  try {
    await postStaffUpdate(db(), {
      incidentId,
      actor: "maintenance_staff",
      text: "Asha called +91 98765 43210 from asha@example.edu in Room 402.",
      knownNames: ["Asha"],
      correlationId,
    });
    await assert.rejects(
      postFacilitiesNotice(db(), { incidentId, actor: "student", text: "Synthetic notice" }),
      { code: "FORBIDDEN" },
    );
    const rows = await db().query<{ reason: string }>(
      "SELECT reason FROM status_events WHERE correlation_id = $1",
      [correlationId],
    );
    const stored = rows.rows[0]!.reason;
    assert.match(stored, /\[NAME\]/);
    assert.match(stored, /\[PHONE\]/);
    assert.match(stored, /\[EMAIL\]/);
    assert.match(stored, /\[ROOM\]/);
    assert.doesNotMatch(stored, /Asha|98765|asha@example\.edu|Room 402/);
    const outbox = await db().query<{ payload: { text: string } }>(
      "SELECT payload FROM outbox WHERE correlation_id = $1",
      [correlationId],
    );
    assert.equal(outbox.rows[0]!.payload.text, stored);
  } finally {
    await cleanup(incidentId);
  }
});

test("staff may reject a proposal back to new", { skip: !enabled }, async () => {
  const incidentId = await createIncident("reject");
  try {
    await proposeTriage(db(), { proposal: proposal(incidentId) });
    const result = await rejectProposal(db(), {
      incidentId,
      actor: "reviewer",
      approverRef: "synthetic-reviewer",
      reason: "The proposal needs more evidence.",
    });
    assert.equal(result.status, "new");
  } finally {
    await cleanup(incidentId);
  }
});
