"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Persona = "student-a" | "student-b" | "maintenance" | "facilities" | "reviewer";
type Section = "overview" | "report" | "requests" | "support" | "queue" | "approvals";
type Location = { id: string; name: string };
type Incident = {
  id: string; category: string; locationId: string; status: string; summary: string;
  etaMinutes: number | null; createdAt: string;
  proposal?: { proposal?: { reason?: string; summary?: string; suggestedEtaMinutes?: number }; simulated?: boolean } | null;
};
type IncidentView = {
  incident: Incident;
  reports: Array<{ id: string; reportText: string; createdAt: string }>;
  events: Array<{ id: string; eventName: string; fromStatus: string | null; toStatus: string | null; reason: string | null; actorType: string; createdAt: string }>;
};

const personas: Array<{ id: Persona; label: string; role: string }> = [
  { id: "student-a", label: "Student · A", role: "Student" },
  { id: "student-b", label: "Student · B", role: "Student" },
  { id: "maintenance", label: "Maintenance team", role: "Maintenance" },
  { id: "facilities", label: "Facilities team", role: "Facilities" },
  { id: "reviewer", label: "Case reviewer", role: "Reviewer" },
];
const eventNames = ["incident.reported", "incident.triage_proposed", "incident.status_changed", "staff.update_posted", "facilities.notice_posted", "proposal.approved", "proposal.rejected", "fix.confirmed"];
const symptoms = [
  { id: "offline", label: "No connection", summary: "Wi-Fi is unavailable" },
  { id: "slow", label: "Very slow", summary: "Wi-Fi is very slow" },
  { id: "drops", label: "Keeps dropping", summary: "Wi-Fi keeps disconnecting" },
  { id: "login", label: "Can’t sign in", summary: "Unable to sign in to Wi-Fi" },
];
const statusLabels: Record<string, string> = {
  new: "Received", triage_proposed: "Needs review", in_progress: "In progress", fix_applied: "Fix applied", resolved: "Resolved",
};
const studentStatusLabels: Record<string, string> = {
  new: "We have your report", triage_proposed: "A staff member is checking", in_progress: "Being fixed",
  fix_applied: "Please check the fix", resolved: "Resolved",
};
const eventLabels: Record<string, string> = {
  "incident.reported": "Report received", "incident.triage_proposed": "Staff review requested",
  "incident.status_changed": "Status updated", "staff.update_posted": "Staff update",
  "facilities.notice_posted": "Facilities update", "proposal.approved": "Review approved",
  "proposal.rejected": "Review requested changes", "fix.confirmed": "Fix confirmed",
};

function Status({ value, student = false }: { value: string; student?: boolean }) {
  const labels = student ? studentStatusLabels : statusLabels;
  return <span className={`status status-${value}`}>{labels[value] ?? value.replaceAll("_", " ")}</span>;
}

export default function HomePage() {
  const [persona, setPersona] = useState<Persona>("student-a");
  const [section, setSection] = useState<Section>("overview");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("north-hostel");
  const [locationFromQr, setLocationFromQr] = useState(false);
  const [symptom, setSymptom] = useState("offline");
  const [reportText, setReportText] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const [staffText, setStaffText] = useState<Record<string, string>>({});
  const [noticeText, setNoticeText] = useState<Record<string, string>>({});
  const [incidentId, setIncidentId] = useState("");
  const [view, setView] = useState<IncidentView | null>(null);
  const [queue, setQueue] = useState<Incident[]>([]);
  const [myReports, setMyReports] = useState<Incident[]>([]);
  const [queueFilter, setQueueFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const announceError = (text: string) => { setMessageKind("error"); setMessage(text); };

  const isStudent = persona.startsWith("student");
  const personaInfo = useMemo(() => personas.find((item) => item.id === persona)!, [persona]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-demo-persona": persona, ...init.headers },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? data.error ?? `Request failed (${response.status})`);
    return data;
  }, [persona]);

  const loadIncident = useCallback(async (id: string) => {
    if (!id) return;
    try { setView(await request(`/incidents/${id}`)); }
    catch (error) { setView(null); announceError(error instanceof Error ? error.message : "Unable to load this report."); }
  }, [request]);
  const loadQueue = useCallback(async () => {
    if (isStudent) return;
    try { setQueue((await request("/staff/queue")).incidents); }
    catch (error) { announceError(error instanceof Error ? error.message : "Unable to load the case queue."); }
  }, [isStudent, request]);
  const loadMyReports = useCallback(async () => {
    if (!isStudent) return;
    try { setMyReports((await request("/my/reports")).incidents); }
    catch (error) { announceError(error instanceof Error ? error.message : "Unable to load your requests."); }
  }, [isStudent, request]);

  useEffect(() => {
    fetch("/api/locations", { cache: "no-store" }).then((response) => response.json())
      .then((data) => setLocations(data.locations ?? []))
      .catch(() => announceError("CommonGround could not reach the service. Check that the API is running."));
  }, []);
  useEffect(() => {
    if (!locations.length) return;
    const fromQr = new URLSearchParams(window.location.search).get("loc");
    if (fromQr && locations.some((location) => location.id === fromQr)) {
      setLocationId(fromQr);
      setLocationFromQr(true);
    }
  }, [locations]);
  useEffect(() => {
    void loadQueue(); void loadMyReports();
    const timer = window.setInterval(() => { if (!document.hidden) { void loadQueue(); void loadMyReports(); } }, 15000);
    return () => window.clearInterval(timer);
  }, [loadQueue, loadMyReports]);
  useEffect(() => {
    if (!isStudent && !incidentId && queue[0]) setIncidentId(queue[0].id);
  }, [isStudent, incidentId, queue]);
  useEffect(() => {
    if (!incidentId) { setView(null); return; }
    void loadIncident(incidentId);
    const stream = new EventSource(`/api/incidents/${incidentId}/events?persona=${persona}`);
    const refresh = () => { void loadIncident(incidentId); void loadQueue(); void loadMyReports(); };
    for (const name of eventNames) stream.addEventListener(name, refresh);
    return () => stream.close();
  }, [incidentId, persona, loadIncident, loadQueue, loadMyReports]);

  async function perform(action: () => Promise<unknown>, success: string, id = incidentId) {
    setBusy(true); setMessage("");
    try { await action(); setMessageKind("success"); setMessage(success); await Promise.all([id ? loadIncident(id) : Promise.resolve(), loadQueue(), loadMyReports()]); }
    catch (error) { announceError(error instanceof Error ? error.message : "The action could not be completed."); }
    finally { setBusy(false); }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedSymptom = symptoms.find((item) => item.id === symptom) ?? symptoms[0]!;
    idempotencyKey.current ??= crypto.randomUUID();
    await perform(async () => {
      const data = await request("/reports", { method: "POST", body: JSON.stringify({
        locationId, summary: selectedSymptom.summary,
        reportText: reportText.trim() || selectedSymptom.summary,
        idempotencyKey: idempotencyKey.current,
      }) });
      setIncidentId(data.incidentId); setReportText(""); idempotencyKey.current = null; setSection("requests");
    }, "Your report is in. You can follow every update from My requests.", "");
  }

  const current = view?.incident;
  const filteredQueue = queue.filter((item) => queueFilter === "all" || item.status === queueFilter);
  const staffTabs: Array<[Section, string]> = persona === "reviewer"
    ? [["queue", "All cases"], ["approvals", "Needs review"]]
    : [["queue", "Case queue"]];
  const tabs: Array<[Section, string]> = isStudent
    ? [["overview", "Home"], ["report", "Report an issue"], ["requests", "My requests"], ["support", "Support"]]
    : staffTabs;
  const pageIntro = isStudent
    ? {
        overview: ["Wi-Fi down? Start here.", "Tell us what’s happening. We’ll keep your updates in one place."],
        report: ["Report a Wi-Fi issue.", "A few details help campus support find the problem."],
        requests: ["Your requests.", "See the latest status and updates shared by campus teams."],
        support: ["Support, on your terms.", "Browse support options without sharing personal details here."],
      }[section as "overview" | "report" | "requests" | "support"]
    : section === "approvals"
      ? ["Review the next step.", "Read each proposal and make the decision as a person."]
      : personaInfo.role === "Maintenance"
        ? ["Restore campus service.", "Clear cases, accountable updates, and decisions made by people."]
        : personaInfo.role === "Reviewer"
          ? ["Review incoming cases.", "Keep case history and human decisions easy to follow."]
          : ["Keep campus teams aligned.", "Clear cases, accountable updates, and decisions made by people."];
  const workHeading = section === "approvals"
    ? ["Review proposals", "A person reviews every proposed next step before staff proceed."]
    : persona === "reviewer"
      ? ["All campus cases", "Track incoming reports and review proposals when they are ready."]
      : persona === "facilities"
        ? ["Facilities coordination", "Share clear facilities updates with the campus support team."]
        : ["Campus service cases", "Coordinate clear updates and keep each Wi-Fi case moving."];

  function openIncident(id: string) { setIncidentId(id); setSection(isStudent ? "requests" : "queue"); }

  return (
    <main className={`app-shell ${isStudent ? "student-shell" : ""}`}>
      <header className="masthead">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection(isStudent ? "overview" : "queue"); }} aria-label="CommonGround home">
          <CommonGroundMark /><span>common<span>ground</span><small>CAMPUS SUPPORT</small></span>
        </a>
        <div className="masthead-right">
          <label className="workspace-select"><span>Preview workspace</span><select value={persona} onChange={(event) => { setPersona(event.target.value as Persona); setIncidentId(""); setSection(event.target.value.startsWith("student") ? "overview" : "queue"); }}>
            {personas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
        </div>
      </header>

      <div className="preview-note"><span>LOCAL PREVIEW</span> Workspaces are simulated for this build. Sign-in and production identity verification are not enabled.</div>

      <section className="page-intro"><div><p className="eyebrow">{isStudent ? "CAMPUS SUPPORT" : `${personaInfo.role.toUpperCase()} WORKSPACE`}</p><h1>{pageIntro[0]}</h1><p>{pageIntro[1]}</p></div>{isStudent && section === "overview" && <button className="button-dark intro-action" onClick={() => setSection("report")}>Report a Wi-Fi issue <span aria-hidden="true">→</span></button>}</section>

      <nav className={`workspace-nav ${isStudent ? "student-nav" : ""}`} aria-label="Workspace navigation">
        <div className="nav-tabs">{tabs.map(([id, label]) => <button key={id} className={section === id ? "nav-tab active" : "nav-tab"} onClick={() => setSection(id)}><NavIcon id={id} /><span>{label}</span>{id === "requests" && myReports.length > 0 && <span className="count">{myReports.length}</span>}{id === "approvals" && <span className="count">{queue.filter((item) => item.status === "triage_proposed").length}</span>}</button>)}</div>
        <span className="nav-role"><span className="role-dot" />{personaInfo.role} view</span>
      </nav>

      {message && <div className={`notice notice-${messageKind}`} role={messageKind === "error" ? "alert" : "status"}><span className="notice-symbol">{messageKind === "error" ? "!" : "✓"}</span>{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}

      {isStudent && section === "overview" && <section className="content-grid overview-grid">
        <article className="intro-card"><span className="wifi-mark" aria-hidden="true"><i /><i /><i /><b /></span><div><p className="eyebrow">CAMPUS WI-FI</p><h2>Let’s get your connection back.</h2><p>Pick what’s happening and where. Add a note only if it helps the team find the issue.</p></div></article>
        <article className="privacy-card"><span className="privacy-icon" aria-hidden="true">i</span><div><h3>Only share what helps</h3><p>Leave out passwords, phone numbers, and room numbers. Your report goes to campus support staff.</p></div></article>
        <article className="support-shortcut"><span className="support-shortcut-mark" aria-hidden="true">+</span><div><p className="eyebrow">PERSONAL SUPPORT</p><h3>Find the right kind of help</h3><p>Browse support options without sharing a personal case here.</p></div><button className="button-outline" onClick={() => setSection("support")}>View support options <span aria-hidden="true">→</span></button></article>
        <section className="platform-grid" aria-label="How CommonGround works">
          <article className="platform-card platform-meko"><div className="platform-card-top"><span className="platform-label">KNOWLEDGE LAYER</span><span className="integration-pill">Not connected in preview</span></div><h3>Meko</h3><p>Designed to hold approved, de-identified service lessons. No student report is sent to Meko or an AI model in this preview.</p></article>
          <article className="platform-card platform-database"><div className="platform-card-top"><span className="platform-label">INCIDENT RECORD</span><span className="integration-pill active">Source of truth</span></div><h3>YugabyteDB</h3><p>Stores incident status and staff updates, keeping the case record authoritative if the knowledge layer is unavailable.</p></article>
        </section>
        <article className="recent-card"><div className="card-title-row"><div><p className="eyebrow">YOUR REQUESTS</p><h2>{myReports.length ? "Pick up where you left off" : "No requests yet"}</h2></div><button className="text-link" onClick={() => setSection("requests")}>View all <span>→</span></button></div>{myReports[0] ? <IncidentRow incident={myReports[0]} locations={locations} onClick={() => openIncident(myReports[0]!.id)} /> : <p className="recent-empty">Your updates will be kept here when you report a campus Wi-Fi issue.</p>}</article>
      </section>}

      {isStudent && section === "report" && <section className="content-grid form-layout">
        <div className="form-aside"><p className="eyebrow">CAMPUS WI-FI</p><h2>What’s not working?</h2><p>Pick the closest match and the place. It takes about ten seconds.</p><div className="privacy-tip"><b>Keep it simple</b><p>Choose a symptom and location. Details are optional. Leave out passwords and phone numbers.</p></div></div>
        <form className="report-form" onSubmit={submitReport}>
          <fieldset className="symptom-field"><legend>Pick what you see</legend><div className="symptom-grid">{symptoms.map((item) => <button key={item.id} type="button" className={`symptom-choice ${symptom === item.id ? "selected" : ""}`} aria-pressed={symptom === item.id} onClick={() => setSymptom(item.id)}><span className="choice-check" aria-hidden="true">{symptom === item.id ? "✓" : ""}</span>{item.label}</button>)}</div></fieldset>
          <label className="location-field"><span>Where?</span><select value={locationId} onChange={(event) => { setLocationId(event.target.value); setLocationFromQr(false); }} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>{locationFromQr && <small>Filled from your campus QR code.</small>}</label>
          <details className="optional-details"><summary>Add a little more detail <span>Optional</span></summary><textarea value={reportText} onChange={(event) => setReportText(event.target.value)} rows={3} maxLength={4000} placeholder="For example, when did it start?" /><small>Don’t include passwords, phone numbers, or room numbers.</small></details>
          <div className="submit-row"><span>Your report goes to campus support staff.</span><button disabled={busy}>{busy ? "Sending…" : "Send report"}<span aria-hidden="true">→</span></button></div>
        </form>
      </section>}

      {isStudent && section === "requests" && <section className="work-area">
        <div className="page-heading"><div><p className="eyebrow">YOUR SUPPORT HISTORY</p><h2>My requests</h2><p>Updates from campus teams appear here as they happen.</p></div><button className="button-dark" onClick={() => setSection("report")}>＋ New report</button></div>
        <div className="request-layout"><div className="request-list">{myReports.length ? myReports.map((incident) => <button key={incident.id} className={`request-item ${incidentId === incident.id ? "selected" : ""}`} onClick={() => openIncident(incident.id)}><span className="request-item-top"><Status value={incident.status} student /><span>{new Date(incident.createdAt).toLocaleDateString()}</span></span><strong>{incident.summary}</strong><span>{locations.find((location) => location.id === incident.locationId)?.name ?? "Campus location"}</span><span className="request-arrow">→</span></button>) : <div className="empty-state"><span>⌁</span><h3>No requests yet</h3><p>When you report an issue, you’ll be able to follow it here.</p><button className="button-dark" onClick={() => setSection("report")}>Report a Wi-Fi issue</button></div>}</div>
          <IncidentDetail view={view} isStudent={isStudent} locations={locations} onFailure={() => current && void perform(() => request(`/incidents/${current.id}/report-failure`, { method: "POST", body: JSON.stringify({ reason: "The Wi-Fi issue is still happening." }) }), "Thanks for letting the team know. The case is back in progress.", current.id)} busy={busy} />
        </div>
      </section>}

      {isStudent && section === "support" && <section className="work-area support-area">
        <div className="page-heading"><div><p className="eyebrow">SUPPORT</p><h2>You deserve support.</h2><p>You can look at these options without sharing personal details.</p></div><button className="exit-button" onClick={() => { setSection("overview"); setIncidentId(""); setView(null); }}>Leave support</button></div>
        <div className="safety-banner"><span className="safety-symbol">!</span><div><strong>Are you in immediate danger?</strong><p>Call India’s emergency response number. This website is not an emergency service.</p></div><a href="tel:112">Call 112 <span>↗</span></a></div>
        <div className="support-options">
          <article className="support-card"><span className="support-index">01 / TALK</span><h3>Talk to someone now</h3><p>For mental health support, the Government of India’s Tele-MANAS line is available 24 hours a day.</p><a className="support-call" href="tel:14416">Call 14416 <span>↗</span></a><small>Also: 1-800-891-4416</small></article>
          <article className="support-card"><span className="support-index">02 / RAGGING</span><h3>Get anti-ragging support</h3><p>The National Anti-Ragging Helpline is available around the clock. You can call or email them directly.</p><a className="support-call" href="tel:18001805522">Call 1800-180-5522 <span>↗</span></a><a className="support-email" href="mailto:helpline@antiragging.in">helpline@antiragging.in</a><a className="support-external" href="https://www.antiragging.in/" target="_blank" rel="noreferrer">Official anti-ragging portal ↗</a></article>
          <article className="support-card"><span className="support-index">03 / CAMPUS ROUTES</span><h3>Choose the right campus contact</h3><p>Sexual-harassment concerns may go to your institution’s Internal Complaints Committee (ICC). Bullying or discrimination may go to its Student Grievance Redressal Committee (SGRC). Ask a trained counsellor if you are unsure.</p><p className="support-honesty">Each institution sets its own contacts and process. Campus contacts are not linked in this preview. This is not a confidential case-reporting channel.</p></article>
        </div>
        <div className="choice-note"><span>YOUR CHOICE MATTERS</span><p>You decide what to share and whom to contact. You can ask about support options without making a formal complaint. A trained campus contact can explain the process and any limits to confidentiality before you disclose details.</p></div>
      </section>}

      {!isStudent && <section className="work-area">
        <div className="page-heading"><div><p className="eyebrow">{personaInfo.role.toUpperCase()} WORKSPACE</p><h2>{workHeading[0]}</h2><p>{workHeading[1]}</p></div><button className="button-outline" onClick={() => void loadQueue()}>↻ <span>Refresh cases</span></button></div>
        <div className="queue-toolbar"><span>{filteredQueue.length} {filteredQueue.length === 1 ? "case" : "cases"}{section === "approvals" ? " to review" : " in your view"}</span></div>
        <div className="staff-layout"><aside className="staff-views" aria-label="Saved case views"><p className="view-title">CASE VIEWS</p>{([ ["all", "All open", queue.length], ["new", "New", queue.filter((item) => item.status === "new").length], ["triage_proposed", "Awaiting review", queue.filter((item) => item.status === "triage_proposed").length], ["in_progress", "In progress", queue.filter((item) => item.status === "in_progress").length], ["fix_applied", "Fix applied", queue.filter((item) => item.status === "fix_applied").length] ] as Array<[string, string, number]>).map(([value, label, count]) => <button key={value} className={`view-button ${queueFilter === value ? "selected" : ""}`} onClick={() => { setQueueFilter(value); setSection("queue"); }}><span>{label}</span><b>{count}</b></button>)}</aside><div className="case-list">{(section === "approvals" ? filteredQueue.filter((item) => item.status === "triage_proposed") : filteredQueue).length ? (section === "approvals" ? filteredQueue.filter((item) => item.status === "triage_proposed") : filteredQueue).map((incident) => <article className="case-card" key={incident.id}>
            <div className="case-card-header"><div><span className="case-kicker">WI-FI SUPPORT <span>·</span> {new Date(incident.createdAt).toLocaleString()}</span><h3>{incident.summary}</h3><p>{locations.find((location) => location.id === incident.locationId)?.name ?? incident.locationId} <span>·</span> Case {incident.id.slice(0, 8)}</p></div><Status value={incident.status} /></div>
            {incident.proposal?.proposal && <div className="proposal-box"><span>PROPOSED NEXT STEP {incident.proposal.simulated && <b>SIMULATED</b>}</span><p>{incident.proposal.proposal.reason || incident.proposal.proposal.summary}</p>{incident.proposal.proposal.suggestedEtaMinutes != null && <small>Suggested time: {incident.proposal.proposal.suggestedEtaMinutes} min</small>}</div>}
            <div className="case-actions"><button className="text-link" onClick={() => openIncident(incident.id)}>View timeline <span>→</span></button>
              {(persona === "maintenance" || persona === "reviewer") && incident.status === "new" && <button className="button-outline" disabled={busy} onClick={() => void perform(() => request(`/incidents/${incident.id}/demo-triage`, { method: "POST", body: "{}" }), "A simulated review proposal is ready.", incident.id)}>Prepare review</button>}
              {persona === "reviewer" && incident.status === "triage_proposed" && <><button className="button-dark" disabled={busy} onClick={() => void perform(() => request(`/incidents/${incident.id}/proposal/approve`, { method: "POST", body: "{}" }), "Proposal approved. Maintenance can proceed.", incident.id)}>Approve next step</button><button className="button-quiet" disabled={busy} onClick={() => void perform(() => request(`/incidents/${incident.id}/proposal/reject`, { method: "POST", body: "{}" }), "Proposal returned for another review.", incident.id)}>Return for changes</button></>}
              {persona === "maintenance" && incident.status === "in_progress" && <button className="button-dark" disabled={busy} onClick={() => void perform(() => request(`/incidents/${incident.id}/confirm-fix`, { method: "POST", body: "{}" }), "Fix marked as applied.", incident.id)}>Confirm fix applied</button>}
              {persona === "maintenance" && incident.status === "fix_applied" && <button className="button-dark" disabled={busy} onClick={() => void perform(() => request(`/incidents/${incident.id}/resolve`, { method: "POST", body: "{}" }), "Case resolved.", incident.id)}>Resolve case</button>}
            </div>
            {persona === "maintenance" && <form className="staff-entry" onSubmit={(event) => { event.preventDefault(); const text = staffText[incident.id]?.trim(); if (!text) return; void perform(() => request(`/incidents/${incident.id}/staff-updates`, { method: "POST", body: JSON.stringify({ text }) }), "Update shared with the student.", incident.id).then(() => setStaffText((old) => ({ ...old, [incident.id]: "" }))); }}><label htmlFor={`update-${incident.id}`}>Share a progress update</label><div><input id={`update-${incident.id}`} value={staffText[incident.id] ?? ""} onChange={(event) => setStaffText((old) => ({ ...old, [incident.id]: event.target.value }))} placeholder="What has the team checked so far?" maxLength={2000} required /><button className="button-outline" disabled={busy}>Post update</button></div></form>}
            {persona === "facilities" && <form className="staff-entry" onSubmit={(event) => { event.preventDefault(); const text = noticeText[incident.id]?.trim(); if (!text) return; void perform(() => request(`/incidents/${incident.id}/facilities-notices`, { method: "POST", body: JSON.stringify({ text }) }), "Facilities update shared.", incident.id).then(() => setNoticeText((old) => ({ ...old, [incident.id]: "" }))); }}><label htmlFor={`notice-${incident.id}`}>Share a facilities update</label><div><input id={`notice-${incident.id}`} value={noticeText[incident.id] ?? ""} onChange={(event) => setNoticeText((old) => ({ ...old, [incident.id]: event.target.value }))} placeholder="What is the facilities team checking?" maxLength={2000} required /><button className="button-outline" disabled={busy}>Post update</button></div></form>}
          </article>) : <div className="empty-state"><span>✓</span><h3>{section === "approvals" ? "You’re all caught up" : "No open cases"}</h3><p>{section === "approvals" ? "New proposals will appear here when they need a human decision." : "New reports will appear in this queue."}</p></div>}</div>
          <IncidentDetail view={view} isStudent={false} locations={locations} onFailure={() => undefined} busy={busy} />
        </div>
      </section>}

      <footer className="site-footer"><a className="brand mini" href="#home"><CommonGroundMark /><span>common<span>ground</span></span></a><span>Restore the service, support the student.</span><span>Local preview · Wi-Fi support only</span></footer>
    </main>
  );
}

function CommonGroundMark() {
  return <svg className="brand-mark" viewBox="0 0 40 40" role="img" aria-label="CommonGround mark"><path d="M20 3.5 36.5 13v14L20 36.5 3.5 27V13L20 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M12 17.1c1.5-3.2 5.3-4.7 8.4-3.2l2.1 1-2.1 1.1c-1.7.9-2.7 2.8-2.4 4.8.3 2 1.8 3.4 3.7 3.7 2 .3 3.8-.7 4.7-2.4l1.2-2.1 1 2.1c1.5 3.2 0 7-3.2 8.5-3.2 1.5-7 0-8.5-3.2-.4-.9-.6-1.8-.6-2.7-3.5.5-6.8-1.7-7.3-5.2-.2-.8-.1-1.7.2-2.4Z" fill="currentColor"/><circle cx="14" cy="27" r="2.2" fill="#d3f16f"/></svg>;
}

function NavIcon({ id }: { id: Section }) {
  const paths: Record<Section, string> = {
    overview: "M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3z",
    report: "M12 5v14M5 12h14",
    requests: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4",
    support: "M20.8 8.8c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z",
    queue: "M4 5h16M4 12h16M4 19h16",
    approvals: "m5 12 4 4L19 6",
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[id]} /></svg>;
}

function IncidentRow({ incident, locations, onClick }: { incident: Incident; locations: Location[]; onClick: () => void }) {
  const location = locations.find((item) => item.id === incident.locationId)?.name ?? "Campus location";
  return <button className="recent-request" onClick={onClick}><span className="recent-copy"><Status value={incident.status} student /><strong>{incident.summary}</strong><small>{location} · {new Date(incident.createdAt).toLocaleDateString()}</small></span><span className="recent-arrow">→</span></button>;
}

function IncidentDetail({ view, isStudent, locations, onFailure, busy }: { view: IncidentView | null; isStudent: boolean; locations: Location[]; onFailure: () => void; busy: boolean }) {
  if (!view) return <aside className="detail-placeholder"><span className="placeholder-mark">cg</span><h3>Case details</h3><p>Select a request to see its progress and the updates shared by the campus team.</p></aside>;
  const { incident, events } = view;
  const statusText = (value: string) => (isStudent ? studentStatusLabels[value] : statusLabels[value]) ?? value.replaceAll("_", " ");
  const locationName = locations.find((location) => location.id === incident.locationId)?.name ?? "Campus location";
  return <aside className="detail-panel"><div className="detail-top"><span className="eyebrow">CASE TIMELINE</span><Status value={incident.status} student={isStudent} /></div><h3>{incident.summary}</h3><p className="detail-meta">{locationName} · {new Date(incident.createdAt).toLocaleDateString()}</p><div className="progress-track">{["new", "triage_proposed", "in_progress", "fix_applied", "resolved"].map((step, index) => { const order = ["new", "triage_proposed", "in_progress", "fix_applied", "resolved"]; const active = order.indexOf(incident.status) >= index; return <span key={step} className={active ? "progress-step done" : "progress-step"} title={statusText(step)}><i />{index < order.length - 1 && <b />}</span>; })}</div><p className="progress-caption">{incident.status === "resolved" ? "This case has been resolved." : `${statusText(incident.status)} · We’ll keep this timeline updated.`}</p>{incident.etaMinutes != null && <div className="eta-note"><span>ESTIMATED TIME</span><strong>About {incident.etaMinutes} minutes</strong><small>This is a staff suggestion, not a guarantee.</small></div>}
    <h4>Updates</h4><ol className="timeline">{events.map((event) => <li key={event.id}><span className="timeline-dot" /><div><strong>{eventLabels[event.eventName] ?? event.eventName.replaceAll(".", " · ")}</strong>{event.reason && <p>{event.reason}</p>}{event.toStatus && <span className="timeline-status">Status · {statusLabels[event.toStatus] ?? event.toStatus.replaceAll("_", " ")}</span>}<small>{new Date(event.createdAt).toLocaleString()}</small></div></li>)}</ol>{isStudent && incident.status === "fix_applied" && <button className="button-quiet failure-button" disabled={busy} onClick={onFailure}>Still having trouble? Let the team know</button>}
  </aside>;
}
