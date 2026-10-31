const ollamaBaseUrl = process.env.OLLAMA_BASE_URL
  ?.replace("host.docker.internal", "localhost")
  .replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL;

if (!ollamaBaseUrl || !ollamaModel) {
  throw new Error("Set OLLAMA_BASE_URL and OLLAMA_MODEL in the process environment.");
}

const syntheticReport = "SIMULATED: Wi-Fi is unavailable in North Hostel common areas; no real student or campus report.";
const prompt = `Return only one JSON object with keys category, proposedStatus, summary, reason, suggestedEtaMinutes, recommendedStaffAction, and incidentId. Use category wifi_outage, status triage_proposed, incidentId 00000000-0000-4000-8000-000000000001, an integer ETA or null, and concise strings. Report: ${syntheticReport}`;
const latencies: number[] = [];
let validJsonCount = 0;

for (let index = 0; index < 10; index += 1) {
  const started = performance.now();
  try {
    const response = await fetch(`${ollamaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ollama" },
      body: JSON.stringify({
        model: ollamaModel,
        temperature: 0,
        messages: [
          { role: "system", content: "Return exactly one JSON object. Do not include markdown." },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("No string content in first completion choice.");

    let parsed: unknown;
    let validJson = false;
    try {
      parsed = JSON.parse(content) as unknown;
      validJson = true;
      validJsonCount += 1;
    } catch {
      parsed = { raw: content };
    }
    const latencyMs = Math.round(performance.now() - started);
    latencies.push(latencyMs);
    console.log(JSON.stringify({ run: index + 1, provider: "ollama", model: ollamaModel, latencyMs, validJson, response: parsed }, null, 2));
  } catch (error) {
    const latencyMs = Math.round(performance.now() - started);
    latencies.push(latencyMs);
    console.log(JSON.stringify({ run: index + 1, provider: "ollama", model: ollamaModel, latencyMs, error: error instanceof Error ? error.message : String(error) }, null, 2));
    break;
  }
}

const sorted = [...latencies].sort((a, b) => a - b);
const medianMs = sorted.length === 0
  ? null
  : sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
console.log(JSON.stringify({ provider: "ollama", model: ollamaModel, attempts: latencies.length, validJsonCount, medianMs }, null, 2));

const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.log(JSON.stringify({ provider: "gemini", status: "not run", reason: "GEMINI_API_KEY is not set." }, null, 2));
} else {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/models", {
    headers: { Authorization: `Bearer ${geminiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  if (!response.ok) throw new Error(`Gemini model listing failed: HTTP ${response.status}`);
  console.log(JSON.stringify({ provider: "gemini", modelIds: (body.data ?? []).map((model) => model.id).filter(Boolean) }, null, 2));
}
