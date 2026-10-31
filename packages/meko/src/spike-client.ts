import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type TextResult = { content?: Array<{ type: string; text?: string }>; isError?: boolean };

function parseToolResult(result: TextResult): unknown {
  if (result.isError) throw new Error("Meko returned an MCP tool error; see the printed response.");
  const body = result.content?.find((item) => item.type === "text")?.text;
  if (!body) throw new Error("Meko tool returned no text content.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function printResponse(label: string, response: unknown): void {
  console.log(`${label}:`);
  console.log(JSON.stringify(response, null, 2));
}

export async function runMekoSpike(): Promise<void> {
  const url = process.env.MEKO_MCP_URL;
  const token = process.env.MEKO_MCP_TOKEN;
  const datapackId = process.env.MEKO_SPIKE_DATAPACK_ID;
  if (!url || !token || !datapackId) {
    throw new Error("Set MEKO_MCP_URL, MEKO_MCP_TOKEN, and MEKO_SPIKE_DATAPACK_ID in the process environment.");
  }

  const client = new Client({ name: "commonground-meko-spike", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    redirectPolicy: "same-origin",
  });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const toolManifest = listed.tools.map(({ name, inputSchema }) => ({ name, inputSchema }));
    const manifest = [
      "# Meko MCP tools",
      "",
      `Direct tools/list result captured on ${new Date().toISOString()}.`,
      "",
      ...toolManifest.flatMap((tool) => [
        `## ${tool.name}`,
        "",
        "```json",
        JSON.stringify(tool.inputSchema, null, 2),
        "```",
        "",
      ]),
    ].join("\n");
    writeFileSync(resolve(process.cwd(), "docs/MEKO_TOOLS.md"), manifest, "utf8");
    printResponse("tools/list", { count: toolManifest.length, schemasWrittenTo: "docs/MEKO_TOOLS.md" });

    const agentId = "codex:Alchemy";
    const conversationRaw = (await client.callTool({
      name: "conversation_create",
      arguments: {
        agent_id: agentId,
        datapack_id: datapackId,
        session_id: randomUUID(),
        title: "CommonGround Meko spike",
      },
    })) as TextResult;
    printResponse("conversation_create", conversationRaw);
    const conversation = parseToolResult(conversationRaw) as { id?: string };
    if (!conversation.id) throw new Error("conversation_create response did not include an id.");

    const marker = `CG-SPIKE-${randomUUID()}`;
    const memoryText = `Synthetic integration check ${marker}; no real student or campus data.`;
    const writeStarted = performance.now();
    const memoryRaw = (await client.callTool({
      name: "memory_add",
      arguments: {
        agent_id: agentId,
        conversation_id: conversation.id,
        datapack_id: datapackId,
        text: memoryText,
      },
    })) as TextResult;
    printResponse("memory_add", memoryRaw);

    const deadline = Date.now() + 30_000;
    let searchable = false;
    while (Date.now() <= deadline) {
      const searchRaw = (await client.callTool({
        name: "memory_search",
        arguments: {
          agent_id: agentId,
          conversation_id: conversation.id,
          datapack_id: datapackId,
          query: marker,
          limit: 5,
        },
      })) as TextResult;
      printResponse("memory_search", searchRaw);
      searchable = JSON.stringify(parseToolResult(searchRaw)).includes(marker);
      if (searchable) break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    }
    const searchLatencyMs = Math.round(performance.now() - writeStarted);
    if (!searchable) throw new Error(`Synthetic note was not searchable within 30 seconds (elapsed ${searchLatencyMs} ms).`);

    const messageRaw = (await client.callTool({
      name: "conversation_add_message",
      arguments: {
        agent_id: agentId,
        conversation_id: conversation.id,
        datapack_id: datapackId,
        input: `Synthetic spike check ${marker}: store a harmless note.`,
        output: "The synthetic note was stored and retrieved in the isolated spike datapack.",
        seed: `commonground-${marker}`,
      },
    })) as TextResult;
    printResponse("conversation_add_message", messageRaw);
    printResponse("spike_summary", { marker, searchLatencyMs, conversationId: conversation.id });
  } finally {
    await client.close();
  }
}
