import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MekoError, MekoGateway, mekoConfigFromEnvironment, type MekoConfig, type MekoLogStore, type MekoTool, type MekoTransport } from "./index.js";

class FakeStore implements MekoLogStore {
  logs: unknown[][] = [];
  approved = false;
  async query<T>(sql: string, values: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    if (sql.includes("human_approvals")) return { rows: (this.approved ? [{ id: values[0] }] : []) as T[], rowCount: this.approved ? 1 : 0 };
    this.logs.push(values);
    return { rows: [] as T[], rowCount: 1 };
  }
}
class FakeTransport implements MekoTransport {
  calls: Array<{ tool: MekoTool; args: Record<string, unknown>; token: string }> = [];
  async call(tool: MekoTool, args: Record<string, unknown>, token: string): Promise<unknown> {
    this.calls.push({ tool, args, token });
    return tool === "conversation_create" ? { id: randomUUID() } : { results: [{ id: "memory-1", text: "network outage" }] };
  }
}
const config = (overrides: Partial<MekoConfig> = {}): MekoConfig => ({
  url: "https://meko.invalid/mcp",
  datapacks: { triage: "pack-triage", bridge: "pack-bridge", commons: "pack-commons" },
  credentials: {
    triage: { token: "triage-secret", agentId: "cg:triage" },
    bridge: { token: "bridge-secret", agentId: "cg:bridge" },
    curator: { token: "curator-secret", agentId: "cg:curator" },
    approver: { token: "approver-secret", agentId: "cg:approver" },
  },
  ...overrides,
});
const request = () => ({ correlationId: randomUUID(), incidentId: randomUUID() });

test("each role uses only its own credential and configured agent ID", async () => {
  const transport = new FakeTransport();
  const store = new FakeStore();
  const gateway = new MekoGateway(store, config(), transport);
  const ctx = request();
  const triage = await gateway.triage.openConversation(ctx, "triage case", randomUUID());
  await gateway.triage.recall(ctx, triage.conversationId, "triage", "staff update");
  await gateway.triage.recall(ctx, triage.conversationId, "commons", "shared lesson");
  await gateway.triage.remember(ctx, triage.conversationId, "redacted triage note");
  const bridge = await gateway.bridge.openConversation(ctx, "bridge", randomUUID());
  await gateway.bridge.recall(ctx, bridge.conversationId, "space availability");
  await gateway.bridge.remember(ctx, bridge.conversationId, "location and time window");
  const curator = await gateway.curator.openConversation(ctx, "lesson draft", randomUUID());
  await gateway.curator.draftLesson(ctx, curator.conversationId, "non-identifying lesson");
  const approval = await gateway.approval.openConversation(ctx, "approved lesson", randomUUID());
  // Promotion is checked separately below; this test validates all role-specific operation routes.
  assert.deepEqual(transport.calls.map((call) => call.token), [
    "triage-secret", "triage-secret", "triage-secret", "triage-secret",
    "bridge-secret", "bridge-secret", "bridge-secret", "curator-secret", "curator-secret", "approver-secret",
  ]);
  assert.deepEqual(transport.calls.map((call) => call.args.agent_id), [
    "cg:triage", "cg:triage", "cg:triage", "cg:triage", "cg:bridge", "cg:bridge", "cg:bridge", "cg:curator", "cg:curator", "cg:approver",
  ]);
  assert.equal(approval.conversationId.length, 36);
  assert.equal("promote" in gateway.triage, false);
  assert.equal("promote" in gateway.bridge, false);
  assert.equal("promote" in gateway.curator, false);
  assert.equal(store.logs.length, transport.calls.length);
});

test("fixed role policy blocks cross-datapack access", async () => {
  const transport = new FakeTransport();
  const gateway = new MekoGateway(new FakeStore(), config(), transport);
  const ctx = request();
  const triage = await gateway.triage.openConversation(ctx, "triage", randomUUID());
  await assert.rejects(() => (gateway.triage.recall as unknown as (...args: unknown[]) => Promise<unknown>)(ctx, triage.conversationId, "bridge", "query"), /cannot call/);
  await assert.rejects(() => (gateway.bridge.recall as unknown as (...args: unknown[]) => Promise<unknown>)(ctx, triage.conversationId, "query"), /conversation created for role 'bridge'/);
  assert.equal(transport.calls.length, 1);
});

test("missing role credentials or agent IDs fail before transport and never fall back", async () => {
  const transport = new FakeTransport();
  const noTriage = config({ credentials: {
    triage: { agentId: "cg:triage" },
    bridge: { token: "bridge-secret", agentId: "cg:bridge" },
    curator: { token: "curator-secret", agentId: "cg:curator" },
    approver: { token: "approver-secret", agentId: "cg:approver" },
  } });
  const gateway = new MekoGateway(new FakeStore(), noTriage, transport);
  await assert.rejects(gateway.triage.openConversation(request(), "triage", randomUUID()), /credential for role 'triage' is not configured/);
  assert.equal(transport.calls.length, 0);

  const missingAgent = config({ credentials: { ...config().credentials, curator: { token: "curator-secret" } } });
  const gatewayNoAgent = new MekoGateway(new FakeStore(), missingAgent, transport);
  await assert.rejects(gatewayNoAgent.curator.openConversation(request(), "curator", randomUUID()), /agent ID for role 'curator' is not configured/);
  assert.equal(transport.calls.length, 0);

  const missingPack = new MekoGateway(new FakeStore(), config({ datapacks: { triage: undefined, bridge: "pack-bridge", commons: "pack-commons" } }), transport);
  await assert.rejects(missingPack.triage.openConversation(request(), "triage", randomUUID()), /datapack 'triage' is not configured/);
  assert.equal(transport.calls.length, 0);
});

test("correlation IDs cannot substitute for a conversation_create result", async () => {
  const transport = new FakeTransport();
  const gateway = new MekoGateway(new FakeStore(), config(), transport);
  assert.throws(() => gateway.triage.remember(request(), randomUUID(), "note"), /Meko conversation created for role 'triage'/);
  assert.equal(transport.calls.length, 0);
});

test("only Approval Service can promote, and persisted approval is required before transport", async () => {
  const store = new FakeStore();
  const transport = new FakeTransport();
  const gateway = new MekoGateway(store, config(), transport);
  const ctx = request();
  const approval = await gateway.approval.openConversation(ctx, "approved lesson", randomUUID());
  const id = randomUUID();
  const before = transport.calls.length;
  await assert.rejects(gateway.approval.promote(ctx, approval.conversationId, [id], randomUUID()), /persisted approved human_approvals/);
  assert.equal(transport.calls.length, before);
  assert.equal("promote" in gateway.triage, false);
  store.approved = true;
  await gateway.approval.promote(ctx, approval.conversationId, [id], randomUUID());
  assert.equal(transport.calls.at(-1)?.tool, "memory_promote");
  assert.equal(transport.calls.at(-1)?.token, "approver-secret");
  assert.equal(transport.calls.at(-1)?.args.datapack_id, "pack-commons");
});

test("recall caches by incident/datapack/query and logs redacted calls", async () => {
  const store = new FakeStore();
  const transport = new FakeTransport();
  const gateway = new MekoGateway(store, config(), transport);
  const ctx = request();
  const conv = await gateway.triage.openConversation(ctx, "triage", randomUUID());
  const first = await gateway.triage.recall(ctx, conv.conversationId, "triage", "email student@example.com");
  const cached = await gateway.triage.recall(ctx, conv.conversationId, "triage", "email student@example.com");
  assert.equal(first.callCount, 1);
  assert.equal(cached.callCount, 0);
  assert.equal(transport.calls.length, 2); // conversation_create plus one memory_search
  assert.equal(store.logs.length, 2);
  assert.equal(JSON.stringify(store.logs).includes("student@example.com"), false);
});

test("MEKO_MODE=off continues to log bypass without credentials or conversation IDs", async () => {
  const store = new FakeStore();
  const transport = new FakeTransport();
  const gateway = new MekoGateway(store, config({ mode: "off", credentials: {} }), transport);
  const result = await gateway.triage.recall(request(), "", "triage", "offline query");
  assert.deepEqual(result.result, { bypassed: true });
  assert.equal(transport.calls.length, 0);
  assert.equal(store.logs[0]?.[6], "bypass");
});

test("bad-token failures are logged and returned without a transport retry beyond configured limit", async () => {
  const store = new FakeStore();
  let calls = 0;
  const transport: MekoTransport = { async call() { calls += 1; throw new Error("401 unauthorized"); } };
  const gateway = new MekoGateway(store, config({ retries: 0 }), transport);
  await assert.rejects(gateway.triage.openConversation(request(), "triage", randomUUID()), /401 unauthorized/);
  assert.equal(calls, 1);
  assert.equal(store.logs.at(-1)?.[6], "failure");
});

test("retry count is capped at two retries and timeout failures are logged", async () => {
  let calls = 0;
  const transport: MekoTransport = { async call() { calls += 1; throw new Error("temporary failure"); } };
  const store = new FakeStore();
  const gateway = new MekoGateway(store, config({ retries: 99 }), transport);
  await assert.rejects(gateway.triage.openConversation(request(), "triage", randomUUID()), /temporary failure/);
  assert.equal(calls, 3);

  const timeoutStore = new FakeStore();
  const hanging: MekoTransport = { call: () => new Promise(() => undefined) };
  const timeoutGateway = new MekoGateway(timeoutStore, config({ retries: 0, timeoutMs: 250 }), hanging);
  await assert.rejects(timeoutGateway.triage.openConversation(request(), "triage", randomUUID()), /timed out/);
  assert.equal(timeoutStore.logs.at(-1)?.[6], "failure");
});

test("environment parsing uses explicit role credentials and does not read a shared token", () => {
  const parsed = mekoConfigFromEnvironment({
    MEKO_TRIAGE_TOKEN: "triage", MEKO_BRIDGE_TOKEN: "bridge", MEKO_CURATOR_TOKEN: "curator", MEKO_APPROVER_TOKEN: "approver",
    MEKO_TRIAGE_AGENT_ID: "a-triage", MEKO_BRIDGE_AGENT_ID: "a-bridge", MEKO_CURATOR_AGENT_ID: "a-curator", MEKO_APPROVER_AGENT_ID: "a-approver",
    MEKO_AGENTS_TOKEN: "shared-must-be-ignored", MEKO_TRIAGE_DATAPACK_ID: "p-triage", MEKO_BRIDGE_DATAPACK_ID: "p-bridge", MEKO_COMMONS_DATAPACK_ID: "p-commons",
  });
  assert.equal(parsed.credentials.triage?.token, "triage");
  assert.equal(parsed.credentials.approver?.token, "approver");
  assert.equal(parsed.credentials.triage?.agentId, "a-triage");
  assert.equal("agent" in parsed.credentials, false);
});
