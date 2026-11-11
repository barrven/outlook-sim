# Product spec: Ontario accident-benefits file tool

**Status:** Draft v0.2 — scoped to an Ontario AB legal assistant  
**Date:** 2026-09-19  
**Purpose:** Define a first version we can actually build. GhostPractice research is background only. The product is what a legal assistant on an Ontario accident-benefits file does every day.

---

## How to use this document

| Column | Meaning |
| --- | --- |
| **User need** | What the legal assistant is trying to do. |
| **Feature** | What the software should let them do. |
| **Decision** | `IN` (v1) / `LATER` / `OUT`. |

v1 is the smallest product that is useful on a live AB file: open the file, docket time, record charges, store documents in a sensible folder structure, track the work that would otherwise live in a paper diary and a shared drive.

---

## 1. Locked product decisions

| Question | Decision |
| --- | --- |
| Market | Ontario only |
| User | Legal assistant (and by extension the lawyer/paralegal they support) on **accident benefits** files |
| Practice area | Statutory accident benefits (SABS) under O. Reg. 34/10, including LAT-AABS disputes |
| Accounting | Bare bones: hours, charges (disbursements), settlement fees. No general ledger, no trust accounting, no month-end books |
| Hosting | Not a v1 decision. Design so either on-prem or cloud can work later |
| Law Society of Ontario | We are **not** building By-Law 9 trust compliance. We still handle client files and money-adjacent records (time, disbursements, settlement fees) carefully |
| PCLaw import | **OUT** of v1. Explained in §10 |
| Collections module | **OUT**. Explained in §10 |
| GhostPractice parity | **OUT**. We are not cloning the full product |

**Assumed, unless you say otherwise:** plaintiff-side personal injury firm (the injured person is the client; the auto insurer is the other side). Defence-side AB work is similar but not the starting point.

---

## 2. What we are building

A matter-centric workspace for Ontario accident-benefits files.

A legal assistant can:

1. Open and maintain an AB file (client, accident, insurer, claim number, benefits in play).
2. Record **hours worked** against that file.
3. Record **charges** (disbursements: records, filing fees, experts, travel).
4. Record **settlement fees** when the AB claim (or a piece of it) settles.
5. Store and organize **documents** on the file (OCFs, medicals, correspondence, LAT materials, settlement docs).
6. Do the other daily AB-assistant work that is not accounting: correspondence log, deadline diary, treatment-plan / benefit / denial tracking, LAT step tracking.

It is closer to “Clio for one practice area, with AB-specific fields” than to GhostPractice.

---

## 3. Who uses it

**Primary user — legal assistant / AB clerk / junior paralegal**

Typical Ontario job postings for this role ask them to:

- Run the file day to day with little supervision
- Complete and chase OCF forms
- Talk to the client, the adjuster, and treatment clinics
- Request and organize medical records (often through Tracument)
- Answer insurer s. 33 requests and diary s. 44 insurer exams / EUOs
- Draft correspondence, LAT applications, case conference summaries
- Schedule case conferences, hearings, client calls, settlement calls
- Watch limitation dates so a denial does not expire
- Keep the electronic file tidy

**Secondary users**

- Paralegal or lawyer who reviews the file, appears at LAT, negotiates settlement
- Maybe a second assistant covering the same caseload

v1 can be single-firm, multi-user, with a simple “this file is assigned to X” field. Full role-based permissions can wait.

---

## 4. What an Ontario AB file actually is

Accident benefits are **no-fault benefits from the injured person’s own auto insurer**, under the Statutory Accident Benefits Schedule (SABS). They are separate from the tort lawsuit against the at-fault driver. Many firms run both files for the same client; v1 is the **AB file**. A link to a related tort file is useful but not required on day one.

### 4.1 Benefit types the assistant is tracking

Not every file has every benefit. The assistant needs to see **which ones are claimed, status, and key amounts**.

| Benefit | Why it is on the file |
| --- | --- |
| Medical / rehabilitation | Treatment plans (OCF-18) and MIG treatment (OCF-23) |
| Attendant care | Form 1 assessments; monthly limits |
| Income replacement (IRB) | Needs OCF-2 + OCF-3; weekly amount; 104-week test |
| Non-earner (NEB) | Alternative to IRB |
| Caregiver | If claimed / optional coverage |
| Housekeeping / home maintenance | Often optional; receipts / OCF-6 |
| Visitor expenses, education, clothing/glasses | Smaller expense claims |
| Death / funeral | Fatal files |
| Catastrophic (CAT) | OCF-19; unlocks higher limits |
| Minor Injury Guideline (MIG) | $3,500 med/rehab cap unless removed |

Injury track on the file: **MIG / non-CAT / CAT** (and “disputed”).

July 2026 SABS reforms made some benefits optional (IRB, NEB, caregiver). The file should record **what coverage this policy actually has**, not assume the old mandatory package.

### 4.2 The paper the assistant lives in (OCF forms)

These are FSCO/FSRA standard forms. v1 does **not** need to be a fillable-form engine. It needs to know they exist, store the PDF, and show status (requested / received / submitted / insurer response).

| Form | Role |
| --- | --- |
| OCF-1 | Application for accident benefits — starts the claim; generally 30 days after the package is received |
| OCF-2 | Employer’s confirmation of income (IRB) |
| OCF-3 | Disability certificate (health practitioner) |
| OCF-6 | Application for expenses + receipts |
| OCF-9 | Explanation of Benefits — **from the insurer** (approvals, denials, cutoffs) |
| OCF-10 | Election of IRB / NEB / caregiver |
| OCF-18 | Treatment and assessment plan (clinic → insurer) |
| OCF-19 | Application for catastrophic impairment |
| OCF-21 | Standard invoice (clinics billing the insurer) |
| OCF-23 | MIG treatment confirmation |
| OCF-24 | MIG discharge / possible exit from MIG |
| Form 1 | Attendant care needs assessment |

### 4.3 Insurer process the assistant runs

- **s. 33** — insurer demands information; assistant gathers and sends it; missed s. 33 can suspend benefits
- **s. 44** — insurer examination (IE / IME); assistant books, sends the brief, diaries the report
- **EUO** — examination under oath; schedule, notify client, gather documents
- **EOB / denial letters** — each clear denial starts a **two-year LAT clock**
- Adjuster correspondence — every letter/email belongs on the file

### 4.4 LAT-AABS (when the insurer says no)

Disputes go to the Licence Appeal Tribunal – Automobile Accident Benefits Service, not court.

Typical path:

1. File **Application by an Injured Person** + **Certificate of Service** + fee (currently $106)
2. Insurer **Response**
3. **Case conference** (summary required under LAT Rule 20.4)
4. Disclosure of documents
5. Motions / summons as needed
6. Hearing (written, video, or in person)
7. Order / decision, or **settlement** before hearing

Assistants draft the application and case conference summary, serve and file, book dates, and build the document brief.

### 4.5 Deadlines that must not be missed

These belong in a diary, not someone’s head.

| Deadline | Typical rule of thumb |
| --- | --- |
| Notify insurer of accident | 7 days (or as soon as practicable) |
| Return OCF-1 | 30 days after receiving the application package |
| Insurer response to OCF-18 | 10 business days |
| LAT application after a denial | **2 years from a clear and unequivocal refusal** — each denial can have its own clock |
| Related tort limitation (if we show it) | Usually 2 years from discoverability; municipal notice 10 days — display only if we link a tort file |

v1 should let the assistant **set and see** these dates. Auto-calculating every SABS rule is LATER.

---

## 5. Domain model (v1)

```
Firm
  └── Users (assistant, lawyer, paralegal)
        └── Contacts (clients, adjusters, clinics, employers, experts, LAT)
              └── Client
                    └── AB Matter
                          ├── Accident (date, location, police report #, vehicles)
                          ├── Policy / insurer (company, claim #, adjuster, coverage options)
                          ├── Injury track (MIG / non-CAT / CAT / disputed)
                          ├── Benefits claimed (type, status, amounts)
                          ├── Forms (OCF and other, with status)
                          ├── Treatment plans (plan #, clinic, submitted, approved/denied, $ )
                          ├── Denials (date, benefit, LAT limitation date)
                          ├── LAT proceeding (app #, steps, dates)
                          ├── Tasks / diary dates
                          ├── Time entries (hours)
                          ├── Charges (disbursements)
                          ├── Settlement(s) + fee
                          ├── Documents (folders + files)
                          └── Activity / correspondence log
```

One client can have more than one AB matter (rare, but a second accident happens). One AB matter may later link to a tort matter (`LATER`).

---

## 6. Feature list

### 6.1 Files, people, and the AB record — IN

| ID | Feature | Why an AB assistant needs it |
| --- | --- | --- |
| FILE-01 | Create / open / close an AB matter | Daily unit of work |
| FILE-02 | Client profile (name, DOB, contact, language, occupation, family doctor) | Intake and every letter |
| FILE-03 | Accident particulars (date of loss, time, location, police report, description) | Every OCF and LAT application |
| FILE-04 | Insurer block: company, policy #, claim #, named insured, adjuster name/phone/email | Daily calling/emailing |
| FILE-05 | Policy coverage flags: which optional benefits exist (IRB, NEB, caregiver, housekeeping, increased limits) | July 2026 reforms; do not assume the old package |
| FILE-06 | Injury track: MIG / non-CAT / CAT / disputed, with CAT application date if any | Changes available limits and strategy |
| FILE-07 | Matter number and status (intake, benefits ongoing, LAT, settled, closed) | Caseload list |
| FILE-08 | Assigned assistant + responsible lawyer/paralegal | Who owns the file |
| FILE-09 | Contacts on the file with a role (client, adjuster, clinic, employer, expert, LAT, other counsel) | Stop hunting in Outlook |
| FILE-10 | Search by client name, matter #, claim #, date of loss | Incoming adjuster call |
| FILE-11 | File list / my caseload, filter by status and assignee | Monday morning |

### 6.2 Hours worked — IN

Assistants docket time even when the file is contingency. It supports internal tracking, costs outlines, and the fee taken on settlement.

| ID | Feature | Notes |
| --- | --- | --- |
| TIME-01 | Record time on a matter: date, user, duration (hours/tenths), description | Core ask |
| TIME-02 | Optional activity type (call, correspondence, records, LAT prep, attendance, etc.) | Simple pick-list, firm-editable later |
| TIME-03 | Optional rate (or use the user’s default rate) | Needed if anyone bills hourly or Legal Expense Insurance |
| TIME-04 | Billable vs non-billable flag | Internal vs client-facing |
| TIME-05 | Edit / void an entry (keep a trace, do not silent-delete) | Mistakes happen |
| TIME-06 | Time list on the matter and a “my time today” view | Assistant checks they docketed the day |
| TIME-07 | Totals: hours and $ on the matter, by user, by date range | Settlement-fee conversation |

**Out of v1:** timers, LEEDES e-billing, automatic Outlook capture, billing-target calendars.

### 6.3 Charges (disbursements) — IN

Money the firm spends on the file and may recover from the client, the settlement, or (rarely) the insurer.

| ID | Feature | Typical AB examples |
| --- | --- | --- |
| CHG-01 | Record a charge: date, vendor, amount, tax, description, receipt flag | Tracument records, LAT fee $106, expert report, courier, process server |
| CHG-02 | Charge category pick-list | Records, filing, expert, travel, other |
| CHG-03 | Paid vs outstanding | Assistant requisitions; bookkeeper may pay elsewhere |
| CHG-04 | Recoverable vs write-off | Not every disbursement is recovered |
| CHG-05 | Attach the invoice/receipt PDF to the charge | Ties to documents |
| CHG-06 | Charge list and running total on the matter | Goes into the settlement statement |

No accounts-payable module, no cheques, no trust. This is a **file-level disbursement log**.

### 6.4 Settlement fees — IN

When an AB claim (or a disputed piece of it) settles, the assistant prepares the settlement paperwork and records what the firm earns.

Ontario PI/AB retainers are often **contingency**: a percentage of amounts recovered, plus disbursements. LAT has little cost recovery, so the firm’s fee usually comes from the settlement itself.

| ID | Feature | Notes |
| --- | --- | --- |
| SET-01 | Record a settlement on the matter: date, insurer, amount, what was released (which benefits / full and final) | A file can settle in stages (e.g. IRB lump sum, later CAT) |
| SET-02 | Record the firm’s fee: % of recovery, flat fee, or hourly total applied | “Settlement fees” |
| SET-03 | Settlement statement sketch: recovery − fee − disbursements = net to client | Bare-bones accounting; not a trust ledger |
| SET-04 | Store settlement documents (release, minutes of settlement, direction re funds) | See DOC folders |
| SET-05 | Matter status → settled / partially settled | Caseload hygiene |

**Out of v1:** trust receipt of settlement funds, electronic funds to client, Law Society Form 9A, invoice posting to a GL.

### 6.5 Documents — IN

This is half the job. Job postings name Primafact, Tracument, Clio, shared drives. v1 should be a **matter-centric filing cabinet** with a default AB folder scheme, not a full DMS.

| ID | Feature | Notes |
| --- | --- | --- |
| DOC-01 | Upload files to a matter (PDF, Word, email .msg/.eml, images) | Drag-and-drop |
| DOC-02 | Default folder template for every new AB matter | See §7 |
| DOC-03 | Create / rename / move folders and files | Assistants live in this |
| DOC-04 | Preview PDF in place | Stop downloading to the desktop |
| DOC-05 | Date, title, who uploaded | Audit-light |
| DOC-06 | Search file names on the matter | “Where is the April EOB?” |
| DOC-07 | Upload a PDF **directly** to the file | GhostPractice users complained they had to save to disk first — do not repeat that |

**Out of v1:** full-text OCR search across all medicals, versioning like iManage, Outlook add-in that files emails in one click, Tracument/Primafact integration, ACL court-form merge.

### 6.6 Everything else an AB assistant does — IN (thin, not a LAT e-filing product)

These are the workflow objects. Keep them simple lists-with-dates, not a rules engine.

| ID | Feature | Assistant action it replaces |
| --- | --- | --- |
| WRK-01 | Correspondence / activity log on the matter (date, type, who, summary, optional doc link) | Sticky notes and undocumented calls |
| WRK-02 | Tasks with due date, assignee, done/not done | “Call clinic”, “serve application” |
| WRK-03 | Deadline diary: list of upcoming dates across my files | Paper diary / Outlook that nobody else can see |
| WRK-04 | Form tracker: OCF (and Form 1) rows with status and document link | Spreadsheet of “did we send the OCF-3?” |
| WRK-05 | Treatment-plan list: clinic, OCF-18/23 #, date submitted, amount, approved / denied / partial, EOB link | The heart of med/rehab files |
| WRK-06 | Benefit list: type, claimed?, weekly or limit amount, start, cutoff, status | IRB $400/wk until date X |
| WRK-07 | Denial register: date received, benefit/plan denied, limitation date (default +2 years, editable), LAT filed? | The clock that gets missed |
| WRK-08 | LAT mini-file: tribunal file #, date filed, fee paid, next step (response, case conference, hearing), key dates | Not e-File; just the docket |
| WRK-09 | s. 33 / s. 44 / EUO events with dates and document links | Productions and exams |
| WRK-10 | Notes / file summary (free text the assistant updates) | “Client in physio 2x/week; IRB ongoing; OCF-18 denied Apr 12” |

**Out of v1:** generating filled OCF PDFs, LAT e-File API, auto-drafting case conference summaries, medical chronology AI, conflict checking beyond a name search.

### 6.7 Firm admin — IN (minimal)

| ID | Feature |
| --- | --- |
| ADM-01 | Log in (email + password) |
| ADM-02 | Users: name, role label (assistant / lawyer / paralegal), default rate |
| ADM-03 | Firm name and letterhead fields (for later document generation) |
| ADM-04 | Activity-type and charge-category lists |

### 6.8 LATER (not v1, still on the map)

| ID | Feature | Why later |
| --- | --- | --- |
| LATER-01 | Related tort file (same client, at-fault insurer, statement of claim dates) | Same assistant often supports both; different limitation and documents |
| LATER-02 | Word templates / merge letters (to adjuster, client, clinic) | High value; needs template design |
| LATER-03 | Outlook: file email to matter in one click | How correspondence actually arrives |
| LATER-04 | Tracument (or equivalent) records requests from the matter | Almost every AB clerk uses this |
| LATER-05 | Default deadline calculator (OCF-1 +30, LAT +2 years from denial) | Easy to get legally wrong; start with manual dates |
| LATER-06 | LAT document checklist / case conference summary template | Once WRK-08 is in daily use |
| LATER-07 | Settlement statement PDF for the client | After SET-03 is trusted |
| LATER-08 | Permissions: hide other people’s files / rates | Needed when the firm grows |
| LATER-09 | Reports: hours by assistant, upcoming limitations, WIP disbursements | Management ask |
| LATER-10 | Client portal | GhostPractice has one; AB clients mostly phone/email |
| LATER-11 | Defence-side AB files | Same SABS, different party labels |

### 6.9 OUT (for this product)

| ID | What | Why |
| --- | --- | --- |
| OUT-01 | Trust accounting / three-way monthly rec / By-Law 9 packs | Accounting is bare bones; this is a different product |
| OUT-02 | General ledger, AP, AR, bank rec, HST returns | Same |
| OUT-03 | PCLaw import | See §10 |
| OUT-04 | Collections / debt recovery | See §10 |
| OUT-05 | Conveyancing / Unity / Teranet | Real estate, not AB |
| OUT-06 | Cheque printing, EFT payroll, cost-recovery copiers | Back office |
| OUT-07 | Multi-province Law Society packs | Ontario only |

---

## 7. Default document folders (every new AB matter)

Assistants will rename, but a standard tree beats an empty drive.

```
01 Intake and retainer
02 Correspondence
   02.01 Client
   02.02 Insurer / adjuster
   02.03 Clinics and treaters
   02.04 Employer
   02.05 Other
03 OCF forms and insurer EOBs
04 Medical records and reports
05 Employment and income
06 Treatment plans (OCF-18 / 23)
07 Insurer exams, s.33, EUO
08 LAT
   08.01 Application and response
   08.02 Case conference
   08.03 Productions
   08.04 Hearing
09 Experts
10 Settlement and releases
11 Time and disbursements (receipts)
99 Closed / archive
```

---

## 8. Bare-bones money model

No double-entry. Three lists on the matter, plus a settlement snapshot.

```
Hours          Σ (hours × rate)     = time value
Charges        Σ recoverable $      = disbursements
Settlement     amount recovered
Fee            % or flat or time    = settlement fee
Net to client  settlement − fee − disbursements   (display only)
```

Rules for v1:

- Time and charges never post to a bank account in this system.
- Settlement fee is a record of what the firm **will take / has taken**, not a trust transfer.
- If the firm later needs trust compliance, that is a new product slice, not a tweak.

---

## 9. v1 screens (so “IN” is concrete)

1. **Sign in**
2. **My files** — table: matter #, client, date of loss, insurer, status, next deadline
3. **Matter home** — summary: client, accident, insurer, track (MIG/CAT), next deadline, running hours $, charges $, settlement status, file summary note
4. **People** — contacts on this file
5. **Benefits / forms / plans / denials** — the four AB trackers (can be tabs)
6. **LAT** — only if a proceeding exists
7. **Diary / tasks** — this file, plus a global “my upcoming” view
8. **Time** — add/list
9. **Charges** — add/list
10. **Settlement** — add/list
11. **Documents** — folder tree + preview
12. **Log** — activity/correspondence
13. **Admin** — users, pick-lists

---

## 10. Terms you asked about

**PCLaw import.** PCLaw is old, widely used Canadian legal accounting software. Firms that switch to GhostPractice (or Clio, CosmoLex, etc.) need their historic matters, balances, and trust ledgers copied in. That importer is a project of its own. You are not replacing a PCLaw shop’s books, so we are not building it.

**Collections module.** GhostPractice’s South African product has a debt-collection factory (letters of demand, promise-to-pay, collection commission). That is collecting unpaid debts for clients, not accident benefits. Irrelevant to this starting point.

**Ontario Law Society / By-Law 9.** That is the rulebook for **trust accounts** (client money in the firm’s mixed-trust bank). GhostPractice is built around it. You said accounting can be bare bones, so we are **not** implementing trust ledgers, monthly three-way reconciliations, or Law Society audit export. We still should not pretend settlement funds were handled in this app.

---

## 11. Open questions (only what still changes v1)

1. **Plaintiff only?** (Assumed yes.)
2. **Same system for the related tort file in v1, or AB-only until it hurts?** (Assumed AB-only.)
3. **Contingency files, hourly, or both?** (Assumed both: docket always; fee on settlement can be % or hourly.)
4. **Do we generate letters in v1, or only store them?** (Assumed store only.)
5. **Multi-user from day one?** (Assumed yes, simple assignee, no fancy permissions.)
6. **Should denial limitation dates default to +2 years, or always be typed?** (Recommend default +2 years, always editable, never treated as legal advice.)

If you answer these, the IN list is the implementation backlog.

---

## 12. Sources (AB workflow)

- Ontario SABS: [O. Reg. 34/10](https://www.ontario.ca/laws/regulation/100034)
- [LAT-AABS application process and forms](https://tribunalsontario.ca/lat-aabs/)
- Ontario AB clerk / legal assistant job descriptions (Diamond Law, ICS Legal, Verkhovets, Haykas, Aviva defence clerk postings) — duties: OCFs, LAT apps, case conference summaries, s. 33, records via Tracument, diary, file organization
- Firm explainers on OCF-1 / 3 / 18, 7-day notice, 30-day application, 2-year LAT limitation from denial
- GhostPractice research remains in git history of spec v0.1; not a v1 requirement

---

## 13. GhostPractice (kept only as context)

GhostPractice is a full law-firm operating system: time, billing, trust accounting, GL, documents, tasks. Useful reference for “matter-centric files + docketing + documents in one place.” We are taking that idea and cutting it down to **one user (AB assistant)** and **one practice area (Ontario SABS)**.

---

## Changelog

| Date | Version | What changed |
| --- | --- | --- |
| 2026-09-19 | v0.1 | GhostPractice research dump. |
| 2026-09-19 | v0.2 | Rescoped to Ontario AB legal assistant. Accounting = hours, charges, settlement fees. Trust/GL/PCLaw/collections out. AB workflow and v1 feature IDs added. |
