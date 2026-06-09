---
title: IFN Backend — Sequence Flows
tags: [ifn, backend, sequence, flows]
---

# IFN Backend — Sequence Flows

PlantUML sequence diagrams for the critical IFN backend flows. Participants: **SPA** (React),
**API** (the relevant Express module), **PG** (Postgres), **Mail** (mailer), **FS** (file storage).

See [[IFN Backend Index]] · [[IFN Backend — Architecture]] · [[IFN Backend — Data Model]].

## 1. Register → verify → session (magic-link)
/home/basil/drive/obsidian/Lumenor/IFN Backend/IFN Backend — Architecture.md
```plantuml
@startuml
autonumber
actor User
participant SPA
participant "API: auth" as API
database PG
participant Mail

User -> SPA : fill register form\n(name,email,role,region,sector,domain,…)
SPA -> API : POST /api/v1/auth/register
API -> API : validate email ends @ifheindia.org (zod)
API -> PG : INSERT users(verified=false) (or find existing)
API -> PG : INSERT magic_tokens(purpose=verify, token_hash, expires)
API -> Mail : send magic link (?token=…)
note right of Mail : dev = console/Ethereal\nprod = SMTP
API --> SPA : 202 "check your email"
User -> Mail : open link
User -> SPA : GET /verify?token route
SPA -> API : GET /api/v1/auth/verify?token=…
API -> PG : SELECT magic_tokens (unconsumed, unexpired)
alt valid
  API -> PG : UPDATE users SET verified=true
  API -> PG : UPDATE magic_tokens SET consumed_at=now()
  API -> PG : INSERT sessions(user_id,…)
  API --> SPA : 200 + Set-Cookie sid (httpOnly,Secure,SameSite)
else invalid/expired
  API --> SPA : 400 {error}
end
@enduml
```

## 2. Passwordless login

```plantuml
@startuml
autonumber
actor User
participant SPA
participant "API: auth" as API
database PG
participant Mail

User -> SPA : enter verified email
SPA -> API : POST /api/v1/auth/login {email}
API -> PG : SELECT users WHERE email=? AND verified
alt found
  API -> PG : INSERT magic_tokens(purpose=login)
  API -> Mail : send login link
  API --> SPA : 202 "check your email"
  User -> SPA : open link -> GET /api/v1/auth/verify?token
  API -> PG : consume token + INSERT sessions
  API --> SPA : 200 + Set-Cookie sid
else not found / unverified
  API --> SPA : 401 {error: register first}
end
@enduml
```

## 3. Create post (+ anonymous masking) and comment

```plantuml
@startuml
autonumber
participant SPA
participant "API: posts" as API
participant "Serializer" as S
database PG

SPA -> API : POST /api/v1/posts {kind,title,problem,solution?,tags,anonymous,…}
API -> API : session + zod + role guard
API -> PG : INSERT posts(author_id=req.user, anonymous,…)
API -> PG : upsert tags + INSERT post_tags\n(new tag -> tag_requests pending)
note over API,PG : idea (not autopsy) also creates ideas_pipeline at G1\n(see flow 4); problem never enters pipeline
API -> S : serialize post
S -> S : if anonymous AND viewer != admin -> hide author
API --> SPA : 201 post

== later: comment ==
SPA -> API : POST /api/v1/posts/:id/comments {body}
API -> PG : INSERT comments
API --> SPA : 201 comment (author masked per rule)
@enduml
```

## 4. Pipeline — submit → assign → pickup → **per-stage deliverables** → review → advance → override

Each gate has a deliverable template; the student submits that stage's deliverables (`idea_submissions`
+ files), the assigned mentor reviews them (`idea_reviews`), and approval advances the gate. Admin can
override any gate. See the dossier fetch in flow 8 and [[IFN Backend — Data Model]].

```plantuml
@startuml
autonumber
actor Student
actor Mentor
actor "Super Admin" as Admin
participant "API: pipeline" as API
database PG
participant FS

== submit ==
Student -> API : POST /api/v1/ideas (basic details + doc/pdf)
API -> PG : SELECT pipeline_settings
alt locked
  API --> Student : 403 submissions closed
else open
  API -> FS : store file (10MB, mime sniff)
  API -> PG : INSERT attachments
  API -> PG : ifn = ifn_counter+1 (atomic) ; INSERT posts + ideas_pipeline(gate=1)
  API -> PG : INSERT gate_transitions(->1, by=student)
  API --> Student : 201 idea IFN-n @ G1
end

== assign mentor (G1->G2) ==
Admin -> API : POST /api/v1/ideas/:id/assign {mentor_id}
API -> API : guard role=admin
API -> PG : UPDATE ideas_pipeline SET mentor_id, gate=2
API -> PG : INSERT gate_transitions(1->2, role=admin)

== mentor pickup (G2->G3) ==
Mentor -> API : POST /api/v1/ideas/:id/pickup
API -> API : guard = assigned mentor (or admin)
API -> PG : UPDATE gate=3 ; INSERT gate_transitions(2->3)

== student submits stage deliverables ==
Student -> API : POST /api/v1/ideas/:id/stages/:gate/submit\n(template fields + files)
API -> API : guard = author ; validate vs stage template + extra_asks
API -> FS : store stage files
API -> PG : INSERT/UPDATE idea_submissions(gate, payload, status=submitted)\n+ attachments(submission_id, gate, slot_key)

== mentor reviews the stage (G3->..->G6) ==
Mentor -> API : POST /api/v1/ideas/:id/stages/:gate/review\n(criteria + feasibility + feedback + decision)
API -> API : assigned-mentor check
API -> PG : INSERT idea_reviews(gate, criteria, decision)
alt decision = approved
  API -> PG : UPDATE idea_submissions.status=approved
  API -> PG : UPDATE ideas_pipeline gate=gate+1 ; INSERT gate_transitions
else decision = revision
  API -> PG : UPDATE idea_submissions.status=revision_requested
  note right of API : student re-submits same gate's deliverables
end

== mentor/admin add a custom deliverable ask ==
Mentor -> API : POST /api/v1/ideas/:id/extra-asks {gate,label}
API -> PG : INSERT idea_extra_asks(status=open)

== admin override (any->any) ==
Admin -> API : POST /api/v1/ideas/:id/gate {gate, reason}
API -> API : guard role=admin ; reason required
API -> PG : UPDATE gate ; INSERT gate_transitions(role=admin, reason)

== reject / refine&retry ==
Admin -> API : POST /api/v1/ideas/:id/refine
API -> PG : UPDATE pipeline_state=refine (KEEP ifn)
Student -> API : POST /api/v1/ideas/:id/resubmit
API -> PG : UPDATE pipeline_state=active, gate=1 (SAME ifn)
API -> PG : INSERT gate_transitions
@enduml
```

## 5. New-tag / #Success request → admin approval

```plantuml
@startuml
autonumber
actor User
actor "Super Admin" as Admin
participant "API: tags" as API
database PG

User -> API : POST /api/v1/tag-requests {tag}  // or POST /posts/:id/success-request
API -> PG : INSERT tag_requests(status=pending)\n(or posts.success_request=pending)
API --> User : 201 pending (fake toast on FE)

Admin -> API : POST /api/v1/tag-requests/:id/approve
API -> PG : UPDATE tags SET approved=true (usable/trending)
API -> PG : UPDATE tag_requests SET status=approved
note right of API : #Success approve ->\nposts.success_request=approved\n+ add 'Success' badge
API --> Admin : 200
@enduml
```

## 6. Calendar event request → approve → add to all students

```plantuml
@startuml
autonumber
actor Founder
actor "Super Admin" as Admin
participant "API: calendar" as API
database PG

Founder -> API : POST /api/v1/event-requests {title,desired_date,note}
API -> PG : INSERT event_requests(status=pending)
API --> Founder : 201 (fake toast)

Admin -> API : POST /api/v1/event-requests/:id/approve {audience}
API -> PG : INSERT events(audience='all'|'self', creator=admin)
API -> PG : UPDATE event_requests SET status=approved, resolved_event_id
API --> Admin : 201 event
note over API,PG : audience='all' -> visible to every student at query time\nno per-user copies; removals via event_hidden
@enduml
```

## 7. Talent Acquisition — apply

```plantuml
@startuml
autonumber
actor Applicant
participant "API: teamboard" as API
database PG

Applicant -> API : POST /api/v1/team-posts/:id/apply {message}
API -> API : session + zod
API -> PG : INSERT team_applications(team_post_id, applicant_id, message, status=sent)
API --> Applicant : 201 "Application sent ✓"
note right of PG : poster can GET /team-posts/:id/applications
@enduml
```

## 8. Idea dossier fetch (mentor / admin see the *full* case file)

```plantuml
@startuml
autonumber
actor "Mentor / Admin" as Viewer
participant SPA
participant "API: pipeline" as API
participant "Authz" as AZ
database PG
participant FS

Viewer -> SPA : open Mentor Review / Admin Panel -> an idea
SPA -> API : GET /api/v1/ideas/:id/dossier
API -> AZ : viewer == author OR assigned mentor OR admin ?
alt allowed
  API -> PG : SELECT post overview + basic_details + feasibility
  API -> PG : SELECT idea_submissions[] (all gates) + payloads
  API -> PG : SELECT attachments[] (by gate/slot) -> signed paths
  API -> PG : SELECT idea_reviews[] (history)
  API -> PG : SELECT idea_extra_asks[]
  API -> PG : SELECT gate_transitions[] (timeline)
  API --> SPA : 200 dossier { overview, basicDetails, feasibility,\n submissions[], attachments[], reviews[], extraAsks[], timeline[] }
  SPA -> FS : download a file (author/mentor/admin only)
else not allowed
  API --> SPA : 403
end
@enduml
```

> Replaces the old behaviour where Mentor Review / Admin Panel showed only a title + description.
> The dossier is the complete record; the public Feed still shows only the post overview.

Related: [[IFN Backend — Architecture]] · [[IFN Backend — Data Model]] · [[IFN Backend — Decisions (ADR)]]
