# ♻️ Revive Frontend

### 💸 Recover Revenue. Intelligently.

Revive Frontend is the **operations UI** for the Revive B2B receivables recovery engine. It lets operators see revenue at risk, work the case queue, approve gated actions, execute recovery steps, track outcomes, inspect a full audit trail, explore **recovery forecasts & what-if simulations**, and run the **Recovery Simulator** to compare multi-step strategies before acting — all driven by the Revive backend.

**Revive IQ** is the in-app intelligence center: ask plain-language questions about the portfolio, customers, cases, forecasts, or Revive itself, and get evidence-backed answers with sources and suggested follow-ups. It is read-only in v1 — it explains and navigates; it does not execute recovery actions.

**Case Assist** is the case-level operator workspace: open it from a specific receivable to diagnose why money is stuck, compare next actions against policy, draft operator-ready language, and confirm a path — always through the same Human Review / Execute gates as the rest of Ops. It is not another portfolio chatbot.

**Recovery War Room** is the incident command center: when a high-impact recovery situation emerges, operators open a temporary workspace to correlate affected cases, see financial impact, approve a coordinated plan, and drive the incident to resolution — then capture a post-incident review. It sits above the case loop; it does not replace Control Tower, Case Assist, or Revive IQ.

**Recovery Simulator** is a dedicated what-if sandbox: pick a receivable, build single- or multi-step strategies, tune assumptions, run seeded Monte Carlo simulations, compare scenarios, and see a transparent recommendation — without ever contacting the customer or changing case state.

**Strategy Lab** is the portfolio layer above the Simulator: change recovery policy knobs (escalation threshold, window, contacts, automation bias), preview the population, simulate Current vs Proposed, compare trade-offs, and approve a strategy configuration — still without executing actions.

🏆 Built for the **Razorpay Buildathon** — **Track 03: AI Revenue Recovery**

---

## 👨‍💻 Author

**Satyabrata Mishra**

---

## 🚀 Razorpay Buildathon · Track 03

### 🎯 AI Revenue Recovery

> Find revenue that’s slipping away and win it back.

Build an agent that detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow: from payment failures and checkout abandonment to overdue receivables.

### ⏱️ Why now

Revenue loss rarely happens in one clean step. A payment degrades, a checkout gets abandoned, a subscription fails, or an invoice goes overdue. AI can now close the loop from detecting the problem to diagnosing it, choosing the right intervention, and recovering the money.

### 🧭 Example directions

- 📉 Payment degradation → root cause → recovery action  
- 🛒 Checkout drop-off recovery  
- 🔁 Failed-subscription recovery  
- 🏢 **B2B receivables chaser** ← Revive’s focus  
- 📲 Mandate retry sequencer  
- 🎙️ Hinglish voice recovery  
- 🤝 Promise-to-pay tracker  

### 📏 The bar

Don’t just identify the problem. Show **measured money recovered** across a batch, with **compliant escalation**, **stopping rules**, and an **audit trail**.

This UI is how operators **see that loop in action** — including what is **likely to happen next** if Revive acts.

---

## 🏗️ Architecture

The frontend is a **thin Ops shell** over the Revive recovery loop. It does not invent business rules — it presents backend state, triggers authorized actions, and makes outcomes, forecasts, and audit visible.

```text
🏠 Landing
    │
    ▼
📊 Dashboard ──► 📈 Forecast ──► horizons · what-if · heatmap
    │
    ▼
📁 Cases ──► 🔎 Case Detail ──► ⚡ Execute
                  │              │
                  │              ├── 🧠 Diagnosis / strategy / policy
                  │              ├── 📈 Case forecast + action what-if
                  │              ├── ◆ Case Assist (this case)
                  │              ├── 🧪 Open in Simulator
                  │              └── 📡 Monitoring outcome
                  │
             👤 Human Review ◄── policy gate · Case Assist entry
                  │
             🧾 Audit Trail ──► newest-first scrollable history
                  │
             📡 Monitoring ──► open loop & recovery views
                  │
             🗼 Control Tower ──► live pipeline · attention · Case Assist
                  │
             🚨 War Room ──► incident command · correlate · plan · resolve
                  │
             🧪 Simulator ──► strategy builder · Monte Carlo · compare · recommend
                  │
             ✦ Revive IQ ──► ask · evidence · sources · follow-ups (portfolio)
```

| Screen | Role in the loop |
|--------|------------------|
| 🏠 **Landing** | Brand + recovery-loop story (Detect → Monitor) |
| 📊 **Dashboard** | Live KPIs — revenue at risk, recovered, recovery rate, P1 queue, recent recoveries; entry to Forecast |
| 📈 **Forecast** | Merchant recovery estimates (7 / 14 / 30-day), portfolio what-if, recovery trend & velocity, root-cause mix, risk heatmap — clearly labeled as forecasts / simulations |
| 📁 **Cases** | Searchable / filterable case queue across the pipeline |
| 🔎 **Case Detail** | Full case brief — risk, cause, policy, execute, ledger, timeline, case forecast, and action what-if comparison · **Case Assist** entry · deep link into Simulator |
| ◆ **Case Assist** | Locked case workspace — evidence, recommendations, policy explain, drafts, and confirm → existing review / execute path |
| 👤 **Human Review** | Approve / reject / escalate gated cases (with reviewer notes) so Execute can unlock · Case Assist for the same case |
| ⚡ **Execute** | One authorized run per action; then monitoring proposes the next step |
| 📡 **Monitoring** | Cases in outcome monitoring / escalated / recovered views |
| 🗼 **Control Tower** | Live recovery pipeline, attention queue, activity · Case Assist on cases that need a next move |
| 🚨 **Recovery War Room** | Incident-level command center — financial impact, diagnosis with evidence, coordinated plan, timeline, progress, postmortem |
| 🧾 **Audit** | Paginated case list + newest-first scrollable timeline with case context |
| 🧪 **Simulator** | Case-level recovery strategy sandbox — multi-step plans, constraints, Monte Carlo outcomes, scenario compare & recommendation (simulated only) |
| 🧪 **Strategy Lab** | Portfolio policy what-if — population filters, knobs/presets, simulate Current vs Proposed, trade-offs, approve config (no execute) |
| ✦ **Revive IQ** | Conversational command center — portfolio, customers, cases, forecasts, and product knowledge with evidence, sources, and deep links into cases |

### 🧩 How the pieces fit

- 🖼️ **Pages** — route-level screens for dashboard, forecast, cases, review, monitoring, audit, Control Tower, **Case Assist**, **Simulator**, and **Revive IQ**  
- 🧩 **Components** — shared layout, status badges, Case Assist entry chip, confirm dialogs, history nav, loading / error states  
- 🔌 **API client** — typed `fetch` layer (`VITE_API_BASE`) talking to Revive Backend `/api/v1`  
- 🧮 **Simulator engine** — client-side Monte Carlo + constraint validation (`src/lib/simulator`) with a facade ready for future `/simulator/*` APIs  
- 🪝 **Hooks** — async data loading, debounced search  
- 🎨 **Design system** — CSS variables, expressive typography, sticky ops chrome, scrollable audit rails  

No silent autonomy in the UI: **policy + human review** gate execution; **monitoring** unlocks the next action. Forecast, what-if, and **Simulator** views are **estimates / counterfactuals**, not booked recovery — the Simulator never calls execute or contacts customers. **Revive IQ** is portfolio-scoped and read-only — it surfaces answers and navigation, never bypasses policy or triggers execute / review from chat. **Case Assist** stays on one case: it can prepare and confirm through the normal review / execute path, but it never silently contacts the customer or overrides policy.

---

## ✦ Revive IQ

Revive IQ is the Ops UI’s **intelligence center**, not a generic embedded chatbot. Merchants ask about the business or about Revive itself; answers stay grounded in Revive’s live data and policy.

| Capability | What you see in the UI |
|------------|------------------------|
| 📚 **Knowledge** | Who Revive IQ is, what it can do, limitations, how to use it |
| 📊 **Portfolio** | Revenue at risk, recovery rate, pending / overdue customers |
| 👥 **Customers** | Lookup by name, why unpaid, recommended next step |
| 📁 **Cases** | Status, priority rationale, decision / policy explain · open case from the answer |
| 📈 **Forecast & analytics** | Horizon estimates, root causes, heatmap — with estimate disclaimers |

**Empty state** opens as a command center: live business overview, category tiles (Revenue & Risk, Customers, Recovery, Forecast, Cases, About), featured prompts, and quick actions.

**Answers** can include evidence, sources, an analyzed checklist, diagnosis confidence where relevant, suggested follow-ups, and links into case detail. Conversations are listed in the sidebar (Today / Yesterday / Earlier) with rename and delete.

**v1 boundary:** Explain and navigate only — no chat-triggered execute, review approve, or customer send.

---

## ◆ Case Assist

Case Assist is the Ops UI’s **case-scoped operator workspace** — not Revive IQ and not a Microsoft-style floating chatbot. Operators open it from a single receivable (Case Detail hero, Human Review, or Control Tower) to decide the next recovery move with full case context.

| Capability | What you see in the UI |
|------------|------------------------|
| 📎 **This case only** | Customer, invoice, outstanding, state, risk, and diagnosis stay pinned while you work |
| 🧭 **Suggested prompts** | Short operator questions — why stuck, what next, policy, draft language, what-if on this case |
| 🧾 **Evidence & recommendation** | Grounded amounts and ranked next actions with policy-aware framing |
| 🛡️ **Policy explain** | Why an action is allowed, blocked, or needs human review — no bypass path |
| ✍️ **Drafts** | Operator-ready wording for reminders / follow-ups when that path is appropriate |
| ✅ **Confirm** | Explicit confirm routes into the same Human Review / Execute flow the rest of Ops uses |

**Entry:** short **Case Assist** chip on Case Detail (next to priority / status). Portfolio questions hand off to **Ask Revive IQ**.

**Boundary:** Never silent execute, never policy bypass, never portfolio-wide chat. Dispute / escalated cases stay gated — Assist explains and routes; it does not invent a contact action.

---

## 🚨 Recovery War Room

Recovery War Room is for **exception handling and high-impact recovery incidents** — not another analytics dashboard.

| Capability | What you see |
|------------|----------------|
| 💥 **Incident board** | Seeded demo incident (Enterprise Billing Failure) with severity + health |
| 💰 **Financial impact** | Revenue at risk, recovered, P1 / customers / escalations |
| 🧠 **Diagnosis + evidence** | Primary cause, confidence, cause mix, grounded evidence bullets |
| 📋 **Coordinated plan** | Multi-step mitigation with Approve / Reject (intent only — existing gates still apply) |
| 📈 **Progress** | What changed, forecast scenarios, simulate progress, resolve → postmortem |

**Entry:** Overview → Recovery War Room, or Control Tower callout.

**Boundary:** Orchestrates humans + AI around a situation. Does not bypass policy, silently execute, or auto-write Strategy Lab policies.

---

## 🧪 Recovery Simulator

The Recovery Simulator answers: **“If I take this recovery action on this receivable, what is likely to happen?”**

It is a dedicated decision-support screen (`/simulator`) — not live execution. Every run is labeled **SIMULATED — NO ACTION WILL BE EXECUTED**.

| Capability | What you see in the UI |
|------------|------------------------|
| 📁 **Case picker** | Search and select a live receivable; active-case summary with outstanding, overdue, priority, root cause |
| 🧱 **Strategy builder** | Multi-step action sequences with delays, presets (Aggressive / Balanced / Conservative), timeline + contact budget |
| ⚙️ **Assumptions** | Payment / response / partial probabilities, recovery window, max contacts, Monte Carlo runs, reproducible seed |
| 🧮 **Outcomes** | Expected recovery & net recovery, recovery rate, full / partial / no-recovery probabilities, expected time, risk, confidence |
| 📊 **Compare** | Save scenarios locally, compare side-by-side, transparent recommendation by optimization objective |
| 🛡️ **Constraints** | Blocks invalid plans (opt-out, dispute, expired window, max contacts) before simulation |

**Engine:** Client-side Monte Carlo in `src/lib/simulator`, calibrated when possible from existing action-comparison data. Scenario history is stored in the browser for now; the API facade is shaped for future backend `/simulator/*` endpoints.

**Entry points:** Navbar **Simulator**, or **Open in Simulator** from Case Detail what-if.

---

## 🧪 Strategy Lab

Strategy Lab answers: **“What recovery strategy should we use across the portfolio, and what is likely to happen if we change it?”**

It sits one level above the case-level Recovery Simulator (`/strategy-lab`).

| Capability | What you see |
|------------|----------------|
| 📁 **Population** | Priority / root-cause filters + live match preview |
| 🎛️ **Knobs & presets** | Escalation threshold, recovery window, max contacts, automation bias · Current / High Value First / Aggressive |
| 🧮 **Simulate & compare** | Current vs Proposed metrics, deltas, recommendation + trade-offs |
| ✅ **Approve** | Stores approved strategy config only — never executes recovery actions |

Backend: `POST /api/v1/strategy-lab/*` on Revive-Backend.

---

## 🛠️ Stack

| Area | Tools |
|------|--------|
| ⚛️ **UI framework** | React 19 · TypeScript · Vite |
| 🧭 **Routing** | React Router |
| 🎨 **Styling** | Custom CSS · CSS variables · Google Fonts (DM Sans, Instrument Serif) |
| 🔌 **Data layer** | REST via `fetch` · typed API modules · env-based API base URL |
| 🧰 **Tooling** | oxlint · TypeScript project references · Vite HMR |
| ☁️ **Backend** | Revive Backend (FastAPI on Render) |

---

## 🔗 Related

⚙️ Engine: **revive-backend** — detect → diagnose → decide → validate → execute → monitor · forecast · simulate · analytics · **Revive IQ** · **Case Assist** · **Recovery War Room** · Recovery Simulator (UI sandbox)

---

✨ Built by **Satyabrata Mishra** for the **Razorpay Buildathon — Track 03: AI Revenue Recovery**
