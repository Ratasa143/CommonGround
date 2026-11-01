import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type MekoTool = "memory_search" | "memory_add" | "conversation_create" | "memory_promote";
export type MekoRole = "triage" | "bridge" | "curator" | "approver";
export type ProductDatapack = "triage" | "bridge" | "commons";

export interface RoleCredential { token?: string; agentId?: string; }
export interface MekoConfig {
  url: string;
  datapacks: Partial<Record<ProductDatapack, string>>;
  credentials: Partial<Record<MekoRole, RoleCredential>>;
  mode?: "on" | "off";
  stub?: boolean;
  timeoutMs?: number;
  retries?: number;
}
export interface MekoRequest { correlationId: string; incidentId?: string; simulated?: boolean; }
export interface MekoTransport { call(tool: MekoTool, args: Record<string, unknown>, token: string): Promise<unknown>; }
export interface MekoLogStore {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface MekoResult { result: unknown; callCount: number; simulated: boolean; }
export interface OpenConversationResult extends MekoResult { conversationId: string; }

export function mekoConfigFromEnvironment(env: NodeJS.ProcessEnv = process.env): MekoConfig {
  return {
    url: env.MEKO_MCP_URL ?? "https://mcp.mekodata.ai/mcp",
    datapacks: { triage: env.MEKO_TRIAGE_DATAPACK_ID, bridge: env.MEKO_BRIDGE_DATAPACK_ID, commons: env.MEKO_COMMONS_DATAPACK_ID },
    credentials: {
      triage: { token: env.MEKO_TRIAGE_TOKEN, agentId: env.MEKO_TRIAGE_AGENT_ID },
      bridge: { token: env.MEKO_BRIDGE_TOKEN, agentId: env.MEKO_BRIDGE_AGENT_ID },
      curator: { token: env.MEKO_CURATOR_TOKEN, agentId: env.MEKO_CURATOR_AGENT_ID },
      approver: { token: env.MEKO_APPROVER_TOKEN, agentId: env.MEKO_APPROVER_AGENT_ID },
    },
    mode: env.MEKO_MODE === "off" ? "off" : "on",
    stub: env.STUB_MEKO === "true",
  };
}

export class MekoError extends Error { constructor(message: string, readonly callCount = 0) { super(message); } }

export class SdkMekoTransport implements MekoTransport {
  constructor(private readonly url: string) {}
  async call(tool: MekoTool, args: Record<string, unknown>, token: string): Promise<unknown> {
    const client = new Client({ name: "commonground-meko", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: { headers: { Authorization: `Bearer ${token}`, "User-Agent": "commonground/0.1.0" } },
      redirectPolicy: "same-origin",
    });
    try {
      await client.connect(transport);
      const response = await client.callTool({ name: tool, arguments: args }) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
      if (response.isError) throw new Error("Meko returned an MCP tool error");
      const body = response.content?.find((part) => part.type === "text")?.text;
      if (!body) throw new Error("Meko returned no text result");
      try { return JSON.parse(body) as unknown; } catch { return body; }
    } finally { await client.close(); }
  }
}

function redact(value: unknown): unknown {
  if (typeof value === "string") return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, "[REDACTED_PHONE]")
    .replace(/\b(?:room|rm|hostel room)\s*#?\s*[A-Z0-9-]+\b/gi, "[REDACTED_ROOM]");
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)]));
  return value;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ConversationOwner = { role: MekoRole; id: string };
const ALLOWED_OPERATIONS: Record<MekoRole, Partial<Record<MekoTool, readonly ProductDatapack[]>>> = {
  triage: { conversation_create: ["triage"], memory_search: ["triage", "commons"], memory_add: ["triage"] },
  bridge: { conversation_create: ["bridge"], memory_search: ["bridge"], memory_add: ["bridge"] },
  curator: { conversation_create: ["commons"], memory_add: ["commons"] },
  approver: { conversation_create: ["commons"], memory_promote: ["commons"] },
};

export class MekoGateway {
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly conversations = new Map<string, ConversationOwner>();
  private calls = 0;

  readonly triage: {
    openConversation: (request: MekoRequest, title: string, sessionId: string) => Promise<OpenConversationResult>;
    recall: (request: MekoRequest, conversationId: string, datapack: "triage" | "commons", query: string) => Promise<MekoResult>;
    remember: (request: MekoRequest, conversationId: string, text: string) => Promise<MekoResult>;
  };
  readonly bridge: {
    openConversation: (request: MekoRequest, title: string, sessionId: string) => Promise<OpenConversationResult>;
    recall: (request: MekoRequest, conversationId: string, query: string) => Promise<MekoResult>;
    remember: (request: MekoRequest, conversationId: string, text: string) => Promise<MekoResult>;
  };
  readonly curator: {
    openConversation: (request: MekoRequest, title: string, sessionId: string) => Promise<OpenConversationResult>;
    draftLesson: (request: MekoRequest, conversationId: string, text: string) => Promise<MekoResult>;
  };
  readonly approval: {
    openConversation: (request: MekoRequest, title: string, sessionId: string) => Promise<OpenConversationResult>;
    promote: (request: MekoRequest, conversationId: string, memoryIds: string[], approvalId: string) => Promise<MekoResult>;
  };

  constructor(private readonly pool: MekoLogStore, private readonly config: MekoConfig, private readonly transport: MekoTransport = new SdkMekoTransport(config.url)) {
    this.triage = {
      openConversation: (r, title, session) => this.openConversation("triage", "triage", r, title, session),
      recall: (r, c, pack, query) => this.recall("triage", pack, r, c, query),
      remember: (r, c, text) => this.remember("triage", "triage", r, c, text),
    };
    this.bridge = {
      openConversation: (r, title, session) => this.openConversation("bridge", "bridge", r, title, session),
      recall: (r, c, query) => this.recall("bridge", "bridge", r, c, query),
      remember: (r, c, text) => this.remember("bridge", "bridge", r, c, text),
    };
    this.curator = {
      openConversation: (r, title, session) => this.openConversation("curator", "commons", r, title, session),
      draftLesson: (r, c, text) => this.remember("curator", "commons", r, c, text),
    };
    this.approval = {
      openConversation: (r, title, session) => this.openConversation("approver", "commons", r, title, session),
      promote: (r, c, ids, approvalId) => this.#promote(r, c, ids, approvalId),
    };
  }

  getCallCount(): number { return this.calls; }

  private async openConversation(role: MekoRole, pack: ProductDatapack, request: MekoRequest, title: string, sessionId: string): Promise<OpenConversationResult> {
    const datapackId = this.requireDatapack(pack);
    const response = await this.invoke(role, request, pack, "conversation_create", {
      title, session_id: sessionId, agent_id: this.agentId(role), datapack_id: datapackId,
    }, { title, session_id: sessionId });
    if (this.isBypass(response.result)) return { ...response, conversationId: "" };
    const conversationId = this.conversationIdFrom(response.result);
    this.conversations.set(conversationId, { role, id: datapackId });
    return { ...response, conversationId };
  }

  private async recall(role: "triage" | "bridge", pack: "triage" | "commons" | "bridge", request: MekoRequest, conversationId: string, query: string): Promise<MekoResult> {
    this.requireConversation(role, conversationId);
    const datapackId = this.requireDatapack(pack);
    const key = `${request.incidentId ?? "none"}:${datapackId}:${query}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { result: cached.value, callCount: 0, simulated: Boolean(request.simulated || this.config.stub) };
    const response = await this.invoke(role, request, pack, "memory_search", {
      query, conversation_id: conversationId, datapack_id: datapackId, limit: 10,
      agent_id: this.agentId(role),
    }, { query });
    this.cache.set(key, { expiresAt: Date.now() + 60_000, value: response.result });
    return response;
  }

  private remember(role: "triage" | "bridge" | "curator", pack: ProductDatapack, request: MekoRequest, conversationId: string, text: string): Promise<MekoResult> {
    this.requireConversation(role, conversationId);
    const datapackId = this.requireDatapack(pack);
    return this.invoke(role, request, pack, "memory_add", {
      text, conversation_id: conversationId, datapack_id: datapackId, agent_id: this.agentId(role),
    }, { text });
  }

  async #promote(request: MekoRequest, conversationId: string, memoryIds: string[], approvalId: string): Promise<MekoResult> {
    this.requireConversation("approver", conversationId);
    const datapackId = this.requireDatapack("commons");
    const approval = await this.pool.query<{ id: string }>(
      "SELECT id FROM human_approvals WHERE id = $1 AND decision = 'approved' AND subject_type = 'meko_memory_promotion' AND subject_id = ANY($2::uuid[])",
      [approvalId, memoryIds],
    );
    if (!approval.rowCount) throw new MekoError("Promotion requires a persisted approved human_approvals row.");
    return this.invoke("approver", request, "commons", "memory_promote", {
      memory_ids: memoryIds, conversation_id: conversationId, datapack_id: datapackId,
      agent_id: this.agentId("approver"),
    }, { memory_ids: memoryIds, approval_id: approvalId });
  }

  private requireConversation(role: MekoRole, conversationId: string): void {
    if (this.config.mode === "off") return;
    const owner = this.conversations.get(conversationId);
    if (!UUID.test(conversationId) || owner?.role !== role) throw new MekoError(`A Meko conversation created for role '${role}' is required.`);
  }
  private conversationIdFrom(result: unknown): string {
    if (typeof result !== "object" || result === null) throw new MekoError("conversation_create did not return a conversation ID.");
    const record = result as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : typeof record.conversation_id === "string" ? record.conversation_id : undefined;
    if (!id || !UUID.test(id)) throw new MekoError("conversation_create returned an invalid Meko conversation ID.");
    return id;
  }
  private requireDatapack(pack: ProductDatapack): string {
    const id = this.config.datapacks[pack];
    if (!id) throw new MekoError(`Meko datapack '${pack}' is not configured.`);
    return id;
  }
  private requireCredential(role: MekoRole): { token?: string; agentId?: string } {
    const credential = this.config.credentials[role];
    if (!credential?.agentId) throw new MekoError(`Meko agent ID for role '${role}' is not configured.`);
    if (!credential.token && !this.config.stub) throw new MekoError(`Meko credential for role '${role}' is not configured.`);
    return credential;
  }
  private agentId(role: MekoRole): string | undefined {
    if (this.config.mode === "off") return undefined;
    return this.config.credentials[role]?.agentId;
  }
  private isBypass(result: unknown): boolean {
    return typeof result === "object" && result !== null && (result as { bypassed?: unknown }).bypassed === true;
  }

  private async invoke(role: MekoRole, request: MekoRequest, pack: ProductDatapack, tool: MekoTool, args: Record<string, unknown>, loggedRequest: unknown): Promise<MekoResult> {
    const started = Date.now();
    const datapack = this.config.datapacks[pack] ?? pack;
    const simulated = Boolean(request.simulated || this.config.stub);
    if (!ALLOWED_OPERATIONS[role][tool]?.includes(pack)) throw new MekoError(`Role '${role}' cannot call '${tool}' in datapack '${pack}'.`);
    if (this.config.mode === "off") {
      await this.log(request, role, datapack, tool, loggedRequest, { bypass: true }, "bypass", Date.now() - started, simulated);
      return { result: { bypassed: true }, callCount: 0, simulated };
    }
    const datapackId = this.requireDatapack(pack);
    args.datapack_id = datapackId;
    let credential: RoleCredential;
    try { credential = this.requireCredential(role); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Meko role configuration is incomplete.";
      await this.log(request, role, datapack, tool, loggedRequest, { error: message }, "failure", Date.now() - started, simulated);
      throw error;
    }
    const maxRetries = Math.max(0, Math.min(2, this.config.retries ?? 1));
    const timeoutMs = Math.max(250, Math.min(15_000, this.config.timeoutMs ?? 5_000));
    for (let attempt = 0; ; attempt += 1) {
      this.calls += 1;
      try {
        const operation = this.config.stub
          ? Promise.resolve(tool === "conversation_create" ? { id: randomUUID(), stubbed: true } : { stubbed: true, tool })
          : this.transport.call(tool, args, credential.token!);
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([operation, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Meko request timed out")), timeoutMs); })])
          .finally(() => { if (timeout) clearTimeout(timeout); });
        await this.log(request, role, datapack, tool, loggedRequest, result, "success", Date.now() - started, simulated);
        return { result, callCount: attempt + 1, simulated };
      } catch (error) {
        if (attempt < maxRetries) { await new Promise((resolveWait) => setTimeout(resolveWait, 100 * (attempt + 1))); continue; }
        const message = error instanceof Error ? error.message : "Meko request failed";
        await this.log(request, role, datapack, tool, loggedRequest, { error: message }, "failure", Date.now() - started, simulated);
        throw new MekoError(message, attempt + 1);
      }
    }
  }

  private async log(request: MekoRequest, role: MekoRole, datapack: string, tool: MekoTool, input: unknown, output: unknown, outcome: "success" | "failure" | "bypass", latencyMs: number, simulated: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO meko_call_log (correlation_id, actor, datapack, tool_name, request_redacted, response_redacted, outcome, latency_ms, simulated)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)`,
      [request.correlationId || randomUUID(), role, datapack, tool, JSON.stringify(redact(input)), JSON.stringify(redact(output)), outcome, latencyMs, simulated],
    );
  }
}
