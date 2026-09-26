"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./ai-admin.css";
type Settings = {
  enabled: boolean; model: string|null; effectiveModel: string|null; keyConfigured: boolean;
  inputRate: number|null; cachedInputRate: number|null; outputRate: number|null; monthlyBudget: number|null;
  verification: { status: string; checkedAt: string|null };
};
type Dashboard = {
  period: {since:string;until:string;days:number};
  stats: {requests:number;successful:number;failed:number;pending:number;inputTokens:number;cachedInputTokens:number;outputTokens:number;averageDurationMs:number|null;estimatedCostUsd:number|null;unknownCostRequests:number;unknownUsageRequests:number};
  credits: {currency:string;month:string;monthlyBudget:number|null;estimatedSpend:number|null;estimatedRemaining:number|null;unknownCostRequests:number;providerBalance:null};
  features: {feature:string;requests:number;tokens:number;estimatedCostUsd:number|null}[];
  daily: {date:string;requests:number;tokens:number;cost:number|null}[];
  history: {id:string;feature:string;model:string;status:string;inputTokens:number|null;cachedInputTokens:number|null;outputTokens:number|null;estimatedCostUsd:number|null;durationMs:number|null;errorCode:string|null;createdAt:string}[];
};
type Envelope<T> = { data:T;meta?:{page:number;total:number;totalPages:number};error?:{message:string} };
const statuses:Record<string,string>={NOT_CHECKED:"Not checked",NOT_CONFIGURED:"Configuration needed",ACCESSIBLE:"Model access verified",INVALID_CREDENTIALS:"Credential rejected",ACCESS_DENIED:"Access denied",MODEL_UNAVAILABLE:"Model unavailable",RATE_LIMITED:"Provider rate limited",PROVIDER_UNAVAILABLE:"Provider unavailable",CONNECTION_FAILED:"Connection failed"};
const featureLabel=(v:string)=>v==="MEDICINE_BOX"?"Medicine box":"Prescription";
const statusLabel=(v:string)=>v==="STARTED"?"Pending / interrupted":v==="SUCCEEDED"?"Successful":"Failed";
const number=(v:number|null)=>v===null?"Unavailable":v.toLocaleString();
const money=(v:number|null)=>v===null?"Unavailable":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:6}).format(v);
const date=(v:string)=>new Date(v).toLocaleString();
export function AiAdmin({version,expired}:{version:string;expired:()=>void}) {
  const [settings,setSettings]=useState<Settings|null>(null),[dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [days,setDays]=useState("30"),[feature,setFeature]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1),[totalPages,setTotalPages]=useState(1);
  const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const expiredRef=useRef(expired),alive=useRef(true),mutation=useRef<AbortController|null>(null);
  useEffect(()=>{expiredRef.current=expired;},[expired]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;mutation.current?.abort();};},[]);
  async function request<T>(path:string,signal:AbortSignal,method="GET",body?:unknown):Promise<Envelope<T>> {
    const response=await fetch(`/api/backend/admin/ai/${path}`,{method,credentials:"same-origin",cache:"no-store",headers:{"X-Session-Version":version,...(body!==undefined?{"Content-Type":"application/json"}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});
    const result=await response.json();
    if(!response.ok){if([401,403,409].includes(response.status)&&!signal.aborted)expiredRef.current();throw new Error(result.error?.message??"Unable to load AI administration.");}
    return result;
  }
  useEffect(()=>{
    const controller=new AbortController();
    const query=new URLSearchParams({days,page:String(page),...(feature?{feature}:{}),...(status?{status}:{})});
    Promise.all([request<Settings>("settings",controller.signal),request<Dashboard>(`usage?${query}`,controller.signal)]).then(([s,d])=>{if(controller.signal.aborted)return;setSettings(s.data);setDashboard(d.data);setTotalPages(d.meta?.totalPages??1);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Unable to load AI administration.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
    // All request inputs are explicit dependencies; the callback ref keeps logout current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[version,days,feature,status,page,refresh]);
  async function mutate(action:"verify"|"settings",body?:unknown) {
    if(busy)return;
    const controller=new AbortController();mutation.current=controller;
    setBusy(action);setError("");setNotice("");
    try {const result=await request<Settings>(action,controller.signal,action==="verify"?"POST":"PATCH",body??{});if(!alive.current)return;setSettings(result.data);setLoading(true);setNotice(action==="verify"?"Connection check completed.":"AI settings saved. New scans use these settings.");setRefresh(v=>v+1);}
    catch(e){if(alive.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Request failed.");}
    finally{if(alive.current)setBusy("");}
  }
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);const optional=(name:string)=>String(f.get(name)??"").trim()===""?null:Number(f.get(name));void mutate("settings",{enabled:f.get("enabled")==="on",model:String(f.get("model")??"").trim()||null,inputRate:optional("inputRate"),cachedInputRate:optional("cachedInputRate"),outputRate:optional("outputRate"),monthlyBudget:optional("monthlyBudget")});}
  const stats=dashboard?.stats,credits=dashboard?.credits;
  const settingsKey=settings?JSON.stringify([settings.enabled,settings.model,settings.inputRate,settings.cachedInputRate,settings.outputRate,settings.monthlyBudget]):"";
  return <div className="ai-admin">
    <div className="ai-toolbar"><span className="ai-provider">✦ OpenAI <span>Prescription & medicine-box extraction</span></span><button onClick={()=>{setLoading(true);setError("");setRefresh(v=>v+1);}} disabled={loading||!!busy}>Refresh</button></div>
    {error&&<p role="alert" className="admin-error">{error} <button onClick={()=>{setLoading(true);setError("");setRefresh(v=>v+1);}}>Try again</button></p>}
    {notice&&<p role="status" className="ai-notice">{notice}</p>}
    {loading&&<p role="status">Loading AI activity…</p>}
    {settings&&<div className="ai-columns">
      <section className="admin-panel ai-connection"><span className="admin-eyebrow">CONNECTION</span><h2>{statuses[settings.verification.status]??"Not checked"}</h2>
        <dl><div><dt>Provider credential</dt><dd>{settings.keyConfigured?"Configured in server environment":"Missing — set OPENAI_API_KEY"}</dd></div><div><dt>Active model</dt><dd>{settings.effectiveModel??"Not configured"}</dd></div><div><dt>Extraction</dt><dd>{!settings.enabled?"Paused":settings.keyConfigured&&settings.effectiveModel?"Enabled":"Configuration needed"}</dd></div><div><dt>Last check</dt><dd>{settings.verification.checkedAt?date(settings.verification.checkedAt):"Never"}</dd></div></dl>
        <button onClick={()=>void mutate("verify")} disabled={!!busy||loading}>{busy==="verify"?"Verifying…":"Verify connection"}</button><p>Checks credential and model access without generating a response. It does not confirm billing balance or extraction compatibility.</p>
      </section>
      <section className="admin-panel ai-credit"><span className="admin-eyebrow">CREDITS & BUDGET · {credits?.month??"CURRENT MONTH"} · UTC</span><h2>{money(credits?.estimatedRemaining??null)}</h2><p>Estimated monthly budget remaining</p><dl><div><dt>Monthly budget</dt><dd>{money(credits?.monthlyBudget??null)}</dd></div><div><dt>Recorded estimated spend</dt><dd>{money(credits?.estimatedSpend??null)}</dd></div><div><dt>OpenAI credit balance</dt><dd>Not available in this integration</dd></div></dl>
        {!!credits?.unknownCostRequests&&<p>{credits.unknownCostRequests} request(s) have unknown cost. Remaining budget cannot be calculated reliably.</p>}
        <p>This is a planning budget, not purchased provider credits or an enforced spending limit. It covers this app’s tracked scans only.</p><a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">Open provider billing ↗</a>
      </section>
    </div>}
    <section className="admin-panel"><div className="ai-section-heading"><div><span className="admin-eyebrow">USAGE & PERFORMANCE</span><h2>Activity at a glance</h2></div><div className="ai-filters"><label>Period<select value={days} disabled={!!busy} onChange={e=>{setLoading(true);setError("");setDays(e.target.value);setPage(1);}}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label>Feature<select value={feature} onChange={e=>{setLoading(true);setError("");setFeature(e.target.value);setPage(1);}}><option value="">All features</option><option value="PRESCRIPTION">Prescription</option><option value="MEDICINE_BOX">Medicine box</option></select></label><label>Outcome<select value={status} onChange={e=>{setLoading(true);setError("");setStatus(e.target.value);setPage(1);}}><option value="">All outcomes</option><option value="SUCCEEDED">Successful</option><option value="FAILED">Failed</option><option value="STARTED">Pending / interrupted</option></select></label></div></div>
      {stats&&<><div className="ai-stats" aria-label="AI statistics"><article><span>Requests</span><strong>{number(stats.requests)}</strong><small>{stats.pending} pending / interrupted</small></article><article><span>Success rate</span><strong>{stats.successful+stats.failed?`${Math.round(stats.successful/(stats.successful+stats.failed)*100)}%`:"—"}</strong><small>{stats.successful} successful · {stats.failed} failed</small></article><article><span>Reported tokens</span><strong>{number(stats.inputTokens+stats.outputTokens)}</strong><small>{number(stats.inputTokens)} input · {number(stats.outputTokens)} output<br/>{number(stats.cachedInputTokens)} cached input</small></article><article><span>Average latency</span><strong>{stats.averageDurationMs===null?"—":`${(stats.averageDurationMs/1000).toFixed(2)}s`}</strong><small>Completed requests</small></article><article><span>Estimated cost</span><strong>{money(stats.estimatedCostUsd)}</strong><small>{stats.unknownCostRequests} with unknown cost</small></article></div>
        {!!stats.unknownUsageRequests&&<p>{stats.unknownUsageRequests} request(s) have no reported token usage. Unknown usage is excluded from token totals.</p>}
        {dashboard!.daily.length>0?<figure className="ai-chart"><figcaption>Daily requests · UTC · {dashboard!.period.days}-day window</figcaption><div className="ai-bars">{dashboard!.daily.map(d=><div key={d.date} title={`${d.date}: ${d.requests} requests, ${d.tokens} reported tokens`}><span>{d.requests}</span><i style={{height:`${Math.max(4,d.requests/Math.max(...dashboard!.daily.map(x=>x.requests))*90)}px`}}/><small>{d.date.slice(5)}</small></div>)}</div></figure>:<p>No tracked requests in this period. Activity appears after the next AI scan.</p>}
        <div className="ai-feature-stats">{dashboard!.features.map(f=><div key={f.feature}><strong>{featureLabel(f.feature)}</strong><span>{number(f.requests)} requests · {number(f.tokens)} reported tokens · {money(f.estimatedCostUsd)}</span></div>)}</div>
      </>}
    </section>
    {settings&&<section className="admin-panel"><span className="admin-eyebrow">CONFIGURATION</span><h2>AI settings</h2><p>Model overrides apply to new scans. Leave the model blank to use PRESCRIPTION_SCAN_MODEL from the server environment. API keys remain on the server.</p>
      <form key={settingsKey} onSubmit={save} className="ai-settings"><label className="ai-toggle"><input type="checkbox" name="enabled" defaultChecked={settings.enabled}/> Enable AI extraction</label><label>Model override<input name="model" defaultValue={settings.model??""} maxLength={120} pattern="[a-zA-Z0-9._:\-]+" placeholder={settings.effectiveModel??"Server default"}/></label>
        <div className="ai-rate-fields">{[["inputRate","Input USD / 1M tokens"],["cachedInputRate","Cached input USD / 1M tokens"],["outputRate","Output USD / 1M tokens"],["monthlyBudget","Monthly budget USD"]].map(([key,label])=><label key={key}>{label}<input type="number" name={key} min="0" max={key==="monthlyBudget"?1000000:10000} step="any" defaultValue={settings[key as "inputRate"]??""} placeholder="Not set"/></label>)}</div>
        <p>Enter rates for the selected model. Costs are estimates saved at request time; changing rates does not recalculate history. Blank input or output rates leave cost unknown. Blank cached rate uses the input rate.</p><button disabled={!!busy||loading}>{busy==="settings"?"Saving…":"Save AI settings"}</button>
      </form>
    </section>}
    <section className="admin-panel"><span className="admin-eyebrow">REQUEST HISTORY</span><h2>Recent AI requests</h2><p>Uses the filters above. Tracking begins with this release; images, medical text and patient identities are not included.</p>
      <div className="ai-table-scroll"><table><caption className="ai-visually-hidden">AI request history</caption><thead><tr>{["Time","Feature / model","Outcome","Input / output tokens","Estimated USD","Latency"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{dashboard?.history.map(r=><tr key={r.id}><td><time dateTime={r.createdAt}>{date(r.createdAt)}</time><small title={r.id}>Request {r.id.slice(0,8)}</small></td><td>{featureLabel(r.feature)}<small>{r.model}</small></td><td><span className={`ai-outcome ai-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span>{r.errorCode&&<small>{r.errorCode.replaceAll("_"," ").toLowerCase()}</small>}</td><td>{number(r.inputTokens)} / {number(r.outputTokens)}<small>{r.cachedInputTokens===null?"Cached input unknown":`${number(r.cachedInputTokens)} cached input`}</small></td><td>{money(r.estimatedCostUsd)}</td><td>{r.durationMs===null?"—":`${(r.durationMs/1000).toFixed(2)}s`}</td></tr>)}</tbody></table></div>
      {!dashboard?.history.length&&!loading&&<p>No requests match these filters.</p>}<div className="ai-pagination"><button disabled={loading||page<=1} onClick={()=>{setLoading(true);setError("");setPage(v=>v-1);}}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={loading||page>=totalPages} onClick={()=>{setLoading(true);setError("");setPage(v=>v+1);}}>Next</button></div>
    </section>
  </div>;
}
