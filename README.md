# ♻️ Revive Frontend

### 💸 Recover Revenue. Intelligently.

Revive Frontend is the **operations UI** for the Revive B2B receivables recovery engine. It lets operators see revenue at risk, work the case queue, approve gated actions, execute recovery steps, track outcomes, inspect a full audit trail, and explore **recovery forecasts & what-if simulations** — all driven by the Revive backend.

**Revive IQ** is the in-app intelligence center: ask plain-language questions about the portfolio, customers, cases, forecasts, or Revive itself, and get evidence-backed answers with sources and suggested follow-ups. It is read-only in v1 — it explains and navigates; it does not execute recovery actions.

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
                  │              └── 📡 Monitoring outcome
                  │
             👤 Human Review ◄── policy gate
                  │
             🧾 Audit Trail ──► newest-first scrollable history
                  │
             📡 Monitoring ──► open loop & recovery views
                  │
             ✦ Revive IQ ──► ask · evidence · sources · follow-ups
```

| Screen | Role in the loop |
|--------|------------------|
| 🏠 **Landing** | Brand + recovery-loop story (Detect → Monitor) |
| 📊 **Dashboard** | Live KPIs — revenue at risk, recovered, recovery rate, P1 queue, recent recoveries; entry to Forecast |
| 📈 **Forecast** | Merchant recovery estimates (7 / 14 / 30-day), portfolio what-if, recovery trend & velocity, root-cause mix, risk heatmap — clearly labeled as forecasts / simulations |
| 📁 **Cases** | Searchable / filterable case queue across the pipeline |
| 🔎 **Case Detail** | Full case brief — risk, cause, policy, execute, ledger, timeline, case forecast, and action what-if comparison |
| 👤 **Human Review** | Approve / reject / escalate gated cases (with reviewer notes) so Execute can unlock |
| ⚡ **Execute** | One authorized run per action; then monitoring proposes the next step |
| 📡 **Monitoring** | Cases in outcome monitoring / escalated / recovered views |
| 🧾 **Audit** | Paginated case list + newest-first scrollable timeline with case context |
| ✦ **Revive IQ** | Conversational command center — portfolio, customers, cases, forecasts, and product knowledge with evidence, sources, and deep links into cases |

### 🧩 How the pieces fit

- 🖼️ **Pages** — route-level screens for dashboard, forecast, cases, review, monitoring, audit, and **Revive IQ**  
- 🧩 **Components** — shared layout, status badges, confirm dialogs, history nav, loading / error states  
- 🔌 **API client** — typed `fetch` layer (`VITE_API_BASE`) talking to Revive Backend `/api/v1`  
- 🪝 **Hooks** — async data loading, debounced search  
- 🎨 **Design system** — CSS variables, expressive typography, sticky ops chrome, scrollable audit rails  

No silent autonomy in the UI: **policy + human review** gate execution; **monitoring** unlocks the next action. Forecast and what-if views are **estimates / counterfactuals**, not booked recovery. **Revive IQ** is read-only — it surfaces answers and navigation, never bypasses policy or triggers execute / review from chat.

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

⚙️ Engine: **revive-backend** — detect → diagnose → decide → validate → execute → monitor · forecast · simulate · analytics · **Revive IQ**

---

✨ Built by **Satyabrata Mishra** for the **Razorpay Buildathon — Track 03: AI Revenue Recovery**
