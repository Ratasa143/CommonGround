"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Persona = "student-a" | "student-b" | "maintenance" | "facilities" | "reviewer";
type Section = "overview" | "report" | "requests" | "queue" | "approvals";
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
const statusLabels: Record<string, string> = {
  new: "Received", triage_proposed: "Needs review", in_progress: "In progress", fix_applied: "Fix applied", resolved: "Resolved",
};
const eventLabels: Record<string, string> = {
  "incident.reported": "Report received", "incident.triage_proposed": "Staff review requested",
  "incident.status_changed": "Status updated", "staff.update_posted": "Staff update",
  "facilities.notice_posted": "Facilities update", "proposal.approved": "Review approved",
  "proposal.rejected": "Review requested changes", "fix.confirmed": "Fix confirmed",
};

function Status({ value }: { value: string }) {
  return <span className={`status status-${value}`}>{statusLabels[value] ?? value.replaceAll("_", " ")}</span>;
}

export default function HomePage() {
  const [persona, setPersona] = useState<Persona>("student-a");
  const [section, setSection] = useState<Section>("overview");
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState("north-hostel");
  const [summary, setSummary] = useState("");
  const [reportText, setReportText] = useState("");
  const [staffText, setStaffText] = useState<Record<string, string>>({});
  const [noticeText, setNoticeText] = useState<Record<string, string>>({});
  const [incidentId, setIncidentId] = useState("");
  const [view, setView] = useState<IncidentView | null>(null);
  const [queue, setQueue] = useState<Incident[]>([]);
  const [myReports, setMyReports] = useState<Incident[]>([]);
  const [queueFilter, setQueueFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
    catch (error) { setView(null); setMessage(error instanceof Error ? error.message : "Unable to load this report."); }
  }, [request]);
  const loadQueue = useCallback(async () => {
    if (isStudent) return;
    try { setQueue((await request("/staff/queue")).incidents); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load the case queue."); }
  }, [isStudent, request]);
  const loadMyReports = useCallback(async () => {
    if (!isStudent) return;
    try { setMyReports((await request("/my/reports")).incidents); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load your requests."); }
  }, [isStudent, request]);

  useEffect(() => {
    fetch("/api/locations", { cache: "no-store" }).then((response) => response.json())
      .then((data) => setLocations(data.locations ?? []))
      .catch(() => setMessage("CommonGround could not reach the service. Check that the API is running."));
  }, []);
  useEffect(() => {
    void loadQueue(); void loadMyReports();
    const timer = window.setInterval(() => { if (!document.hidden) { void loadQueue(); void loadMyReports(); } }, 15000);
    return () => window.clearInterval(timer);
  }, [loadQueue, loadMyReports]);
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
    try { await action(); setMessage(success); await Promise.all([id ? loadIncident(id) : Promise.resolve(), loadQueue(), loadMyReports()]); }
    catch (error) { setMessage(error instanceof Error ? error.message : "The action could not be completed."); }
    finally { setBusy(false); }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const data = await request("/reports", { method: "POST", body: JSON.stringify({
        locationId, summary, reportText: reportText.trim() || summary, idempotencyKey: crypto.randomUUID(),
      }) });
      setIncidentId(data.incidentId); setReportText(""); setSummary(""); setSection("requests");
    }, "Your report is in. You can follow every update from My requests.", "");
  }

  const current = view?.incident;
  const filteredQueue = queue.filter((item) => queueFilter === "all" || item.status === queueFilter);
  const staffTabs: Array<[Section, string]> = persona === "reviewer"
    ? [["queue", "All cases"], ["approvals", "Needs review"]]
    : [["queue", "Case queue"]];
  const tabs: Array<[Section, string]> = isStudent
    ? [["overview", "Overview"], ["report", "Report an issue"], ["requests", "My requests"]]
    : staffTabs;

  function openIncident(id: string) { setIncidentId(id); setSection(isStudent ? "requests" : "queue"); }

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection(isStudent ? "overview" : "queue"); }} aria-label="CommonGround home">
          <span className="brand-mark"><i /><i /><i /></span><span>common<span>ground</span><small>CAMPUS SERVICE DESK</small></span>
        </a>
        <div className="masthead-right">
          <span className="service-indicator"><i /> Service desk online</span>
          <label className="workspace-select"><span>Preview workspace</span><select value={persona} onChange={(event) => { setPersona(event.target.value as Persona); setIncidentId(""); setSection(event.target.value.startsWith("student") ? "overview" : "queue"); }}>
            {personas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
        </div>
      </header>

      <div className="preview-note"><span>LOCAL PREVIEW</span> Workspaces are simulated for this build. Sign-in and production identity verification are not enabled.</div>

      <section className="welcome-band">
        <div className="welcome-copy">
          <p className="eyebrow">{isStudent ? "CAMPUS SUPPORT, WITH YOU AT EVERY STEP" : `${personaInfo.role.toUpperCase()} WORKSPACE`}</p>
          <h1>{isStudent ? <>A campus that <em>listens</em><br />gets better together.</> : <>{personaInfo.role === "Reviewer" ? "Make the call." : personaInfo.role === "Maintenance" ? "Get service back." : "Keep teams in sync."}</>}</h1>
          <p>{isStudent ? "Report a Wi-Fi issue and follow the people working to fix it. Clear updates, all in one place." : personaInfo.role === "Reviewer" ? "Review proposed next steps and approve or return them with a clear reason." : "See what is happening, share an update, and keep each case moving."}</p>
          {isStudent && <button className="button-light" onClick={() => setSection("report")}>Report a Wi-Fi issue <span aria-hidden="true">↗</span></button>}
        </div>
        <div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-center"><span>cg</span></div><div className="art-label label-top">listen</div><div className="art-label label-right">respond</div><div className="art-label label-bottom">improve</div><div className="art-spark">✳</div></div>
        <div className="welcome-caption"><span>01 / 03</span><span>Restore the service, support the student.</span></div>
      </section>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        <div className="nav-tabs">{tabs.map(([id, label]) => <button key={id} className={section === id ? "nav-tab active" : "nav-tab"} onClick={() => setSection(id)}>{label}{id === "requests" && myReports.length > 0 && <span className="count">{myReports.length}</span>}{id === "approvals" && <span className="count">{queue.filter((item) => item.status === "triage_proposed").length}</span>}</button>)}</div>
        <span className="nav-role"><span className="role-dot" />{personaInfo.role} view</span>
      </nav>

      {message && <div className="notice" role="status"><span className="notice-symbol">✓</span>{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}

      {isStudent && section === "overview" && <section className="content-grid overview-grid">
        <article className="intro-card"><p className="eyebrow">YOUR CAMPUS, IN THE LOOP</p><h2>Support should feel simple.</h2><p>Tell us where Wi-Fi is down. We’ll keep the updates here, so you know what’s happening and what comes next.</p><button className="text-link" onClick={() => setSection("report")}>Start a report <span>→</span></button></article>
        <article className="step-card"><span className="step-number">01</span><div><h3>Tell us what’s affected</h3><p>Choose the campus location and give the issue a short description.</p></div></article>
        <article className="step-card"><span className="step-number">02</span><div><h3>Staff investigate</h3><p>Follow progress and read updates from the teams working on it.</p></div></article>
        <article className="step-card"><span className="step-number">03</span><div><h3>You stay informed</h3><p>See when a fix is applied. Let us know if the issue continues.</p></div></article>
        <article className="privacy-card"><span className="privacy-icon">✳</span><div><h3>Share only what helps</h3><p>Include details about the Wi-Fi problem. Please leave out passwords, phone numbers, room numbers, and other personal information.</p></div></article>
        {myReports.length > 0 && <article className="recent-card"><div className="card-title-row"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Your latest request</h2></div><button className="text-link" onClick={() => setSection("requests")}>All requests →</button></div><IncidentRow incident={myReports[0]!} onClick={() => openIncident(myReports[0]!.id)} /></article>}
      </section>}

      {isStudent && section === "report" && <section className="content-grid form-layout">
        <div className="form-aside"><p className="eyebrow">REPORT A WI-FI ISSUE</p><h2>Help us understand what’s not working.</h2><p>It takes about a minute. Your report goes to the campus team responsible for restoring the service.</p><div className="privacy-tip"><b>Before you send</b><p>Keep it focused on the connection issue. Don’t include passwords or personal contact details.</p></div><div className="form-sequence"><span className="sequence-active">01 <i /> Details</span><span>02 <i /> Submit</span><span>03 <i /> Updates</span></div></div>
        <form className="report-form" onSubmit={submitReport}>
          <div className="form-header"><span className="form-icon">⌁</span><div><p className="eyebrow">CAMPUS WI-FI</p><h2>What’s happening?</h2></div><span className="required-note">* Required</span></div>
          <label>Where are you experiencing this?<span className="field-help">Choose the closest location.</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label>Give it a short title <span className="required-star">*</span><input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={240} placeholder="e.g. Wi-Fi disconnects in the north study area" required /><span className="field-help align-right">{summary.length}/240</span></label>
          <label>Describe the connection problem <span className="optional">Optional</span><textarea value={reportText} onChange={(event) => setReportText(event.target.value)} rows={4} maxLength={4000} placeholder="When did it start? Does it affect one device or the whole area?" /><span className="field-help">Please don’t include names, passwords, or room numbers.</span></label>
          <div className="submit-row"><span>Your request is visible to the campus support team.</span><button disabled={busy || !summary.trim()}>{busy ? "Sending…" : "Send report"}<span>→</span></button></div>
        </form>
      </section>}

      {isStudent && section === "requests" && <section className="work-area">
        <div className="page-heading"><div><p className="eyebrow">YOUR SUPPORT HISTORY</p><h2>My requests</h2><p>Updates from campus teams appear here as they happen.</p></div><button className="button-dark" onClick={() => setSection("report")}>＋ New report</button></div>
        <div className="request-layout"><div className="request-list">{myReports.length ? myReports.map((incident) => <button key={incident.id} className={`request-item ${incidentId === incident.id ? "selected" : ""}`} onClick={() => openIncident(incident.id)}><span className="request-item-top"><Status value={incident.status} /><span>{new Date(incident.createdAt).toLocaleDateString()}</span></span><strong>{incident.summary}</strong><span>{locations.find((location) => location.id === incident.locationId)?.name ?? incident.locationId}</span><span className="request-arrow">→</span></button>) : <div className="empty-state"><span>⌁</span><h3>No requests yet</h3><p>When you report an issue, you’ll be able to follow it here.</p><button className="button-dark" onClick={() => setSection("report")}>Report a Wi-Fi issue</button></div>}</div>
          <IncidentDetail view={view} isStudent={isStudent} onFailure={() => current && void perform(() => request(`/incidents/${current.id}/report-failure`, { method: "POST", body: JSON.stringify({ reason: "The Wi-Fi issue is still happening." }) }), "Thanks for letting the team know. The case is back in progress.", current.id)} busy={busy} />
        </div>
      </section>}

      {!isStudent && <section className="work-area">
        <div className="page-heading"><div><p className="eyebrow">{personaInfo.role.toUpperCase()} WORKSPACE</p><h2>{section === "approvals" ? "Review proposals" : "Campus service cases"}</h2><p>{section === "approvals" ? "A person reviews every proposed next step before staff proceed." : "Coordinate clear updates and keep each Wi-Fi case moving."}</p></div><button className="button-outline" onClick={() => void loadQueue()}>↻ <span>Refresh cases</span></button></div>
        <div className="queue-toolbar"><span>{filteredQueue.length} {filteredQueue.length === 1 ? "case" : "cases"}{section === "approvals" ? " to review" : " in your view"}</span><label>Show <select value={queueFilter} onChange={(event) => setQueueFilter(event.target.value)}><option value="all">All open</option><option value="new">New</option><option value="triage_proposed">Needs review</option><option value="in_progress">In progress</option><option value="fix_applied">Fix applied</option></select></label></div>
        <div className="staff-layout"><div className="case-list">{(section === "approvals" ? filteredQueue.filter((item) => item.status === "triage_proposed") : filteredQueue).length ? (section === "approvals" ? filteredQueue.filter((item) => item.status === "triage_proposed") : filteredQueue).map((incident) => <article className="case-card" key={incident.id}>
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
          <IncidentDetail view={view} isStudent={false} onFailure={() => undefined} busy={busy} />
        </div>
      </section>}

      <footer className="site-footer"><a className="brand mini" href="#home"><span className="brand-mark"><i /><i /><i /></span><span>common<span>ground</span></span></a><span>Restore the service, support the student.</span><span>Local preview · Incident records stored in YugabyteDB</span></footer>
    </main>
  );
}

function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  return <button className="recent-request" onClick={onClick}><span className="recent-copy"><Status value={incident.status} /><strong>{incident.summary}</strong><small>{incident.locationId} · {new Date(incident.createdAt).toLocaleDateString()}</small></span><span className="recent-arrow">→</span></button>;
}

function IncidentDetail({ view, isStudent, onFailure, busy }: { view: IncidentView | null; isStudent: boolean; onFailure: () => void; busy: boolean }) {
  if (!view) return <aside className="detail-placeholder"><span className="placeholder-mark">cg</span><h3>Case details</h3><p>Select a request to see its progress and the updates shared by the campus team.</p></aside>;
  const { incident, events } = view;
  return <aside className="detail-panel"><div className="detail-top"><span className="eyebrow">CASE TIMELINE</span><Status value={incident.status} /></div><h3>{incident.summary}</h3><p className="detail-meta">{incident.locationId} · {new Date(incident.createdAt).toLocaleDateString()}</p><div className="progress-track">{["new", "triage_proposed", "in_progress", "fix_applied", "resolved"].map((step, index) => { const order = ["new", "triage_proposed", "in_progress", "fix_applied", "resolved"]; const active = order.indexOf(incident.status) >= index; return <span key={step} className={active ? "progress-step done" : "progress-step"} title={statusLabels[step]}><i />{index < order.length - 1 && <b />}</span>; })}</div><p className="progress-caption">{incident.status === "resolved" ? "This case has been resolved." : `${statusLabels[incident.status] ?? "In progress"} · We’ll keep this timeline updated.`}</p>{incident.etaMinutes != null && <div className="eta-note"><span>ESTIMATED TIME</span><strong>About {incident.etaMinutes} minutes</strong><small>This is a staff suggestion, not a guarantee.</small></div>}
    <h4>Updates</h4><ol className="timeline">{events.map((event) => <li key={event.id}><span className="timeline-dot" /><div><strong>{eventLabels[event.eventName] ?? event.eventName.replaceAll(".", " · ")}</strong>{event.reason && <p>{event.reason}</p>}{event.toStatus && <span className="timeline-status">Status · {statusLabels[event.toStatus] ?? event.toStatus.replaceAll("_", " ")}</span>}<small>{new Date(event.createdAt).toLocaleString()}</small></div></li>)}</ol>{isStudent && incident.status === "fix_applied" && <button className="button-quiet failure-button" disabled={busy} onClick={onFailure}>Still having trouble? Let the team know</button>}
  </aside>;
}
