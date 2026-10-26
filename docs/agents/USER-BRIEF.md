# User brief

Who the guardhouse system is for and what they need to get done. Tags: `[E]` evidence (observed, told, or linked), `[A]` assumption (a guess, still to validate). Terms follow `CONTEXT.md`.

Source so far: `docs/intent.md` and `docs/architecture.md`, written by the team. As of 2026-10-25 nobody on the team has observed or interviewed a guard, HOA officer or owner, so every claim about their work below is `[A]`. Project constraints the team decided (one gate, guard confirms every plate) are design decisions, not user evidence, and are not tagged here.

## Job

> When a car pulls up to the gate, I want to know right away whether it belongs to a house in this subdivision, so I can wave it through or record the visitor without holding up the line. `[A]`

> When a visitor leaves, I want to hand back the right ID and close their visit, so I can see who is still inside. `[A]`

> When an owner gets a new car or moves out, I want to update the registry, so the guard stops treating a resident's car as a visitor. `[A]`

> When I run the system for several subdivisions, I want to see which ones are active and whether their camera works, so I can fix problems before a guard calls. `[A]`

## Personas

**Guard (on duty at the gate)**
- Goal: let registered cars in fast and record each visitor's ID, purpose and destination `[A]`
- Context: sits at the guardhouse laptop, often with a car waiting and a driver talking to them; may work night shifts `[A]`
- Proficiency: knows many residents' cars by sight; may type slowly and has little practice with web apps `[A]`
- Pains: writing visitor details in the logbook takes time while the car waits; finding a past visitor in the logbook means paging by hand `[A]` (stated in `intent.md`, not observed)

**HOA officer**
- Goal: keep the registry correct and look up who came in and when `[A]`
- Context: office hours, at the same laptop or a desk; works on the registry in batches, for example after a monthly dues collection `[A]`
- Proficiency: comfortable with spreadsheets; may already keep a masterlist of houses and plates `[A]`
- Pains: the guard does not have the latest list of resident cars `[A]`

**Provider**
- Goal: add subdivisions, set each camera address, deactivate a subdivision that stops using the system `[A]`
- Context: the team itself, on a development laptop `[E]` (`CONTEXT.md` defines the provider as the team)
- Proficiency: high, in both domain and tooling `[E]`
- Pains: none known yet; the team is the user

Why three types: they need different records. The guard works one car at a time under time pressure, the HOA officer edits the registry and reads history, and the provider never sees houses, entries or photos.

## Mental model

The guard's assumed vocabulary, to check against `CONTEXT.md` in the first conversation with a guard:

- "Resident" or "may sticker" for a registered car, "bisita" or "guest" for a visitor. `CONTEXT.md` uses Registered vehicle and Visitor, and reserves "guest" for one purpose. If guards say "guest" for every visitor, the visitor form's Purpose field will confuse them. `[A]`
- "Iiwan ang ID" (leave the ID) for a held ID, and "kinuha na ang ID" for an exit. `[A]`
- Destinations given as "Block 19" or "kina Dela Cruz" (the Dela Cruz house). `CONTEXT.md` already models both as a block or a residence. `[A]`

## Assumption ledger

| Claim | Tag | Confidence | Impact | Action |
|---|---|---|---|---|
| Guards today use a paper logbook for visitors | `[A]` | medium | high | **validate**: ask one guard at a real gate to show their logbook |
| Guards recognize most resident cars by memory | `[A]` | medium | high | **validate**: same visit; ask how they handle a car they don't recognize |
| A guard can confirm a plate and pick a destination while a car waits, in under a minute | `[A]` | low | high | **validate**: time a guard on the prototype with printed plates |
| Guards take and hold an ID from every visitor | `[A]` | medium | high | **validate**: ask whether some visitors (delivery riders) refuse or are waved through |
| Guards say "guest" for every visitor | `[A]` | low | medium | ask in the same visit; feeds `CONTEXT.md` if true |
| HOA officers already keep a masterlist of houses and plates | `[A]` | medium | medium | ask one HOA officer; if yes, an import beats typing every house |
| The guardhouse laptop sits in front of the guard, not in a back room | `[A]` | low | medium | record as risk; affects screen layout and sound |
| Night shift guards work in low light | `[A]` | low | low | record as risk; affects contrast |

## Open questions

- Has anyone on the team visited a subdivision gate? One visit would settle the first four rows of the ledger.
- What happens today when a visitor has no ID at all?
- Does the guard need to see the camera view, or only the plate reading?
- Unknown unknowns: the picture is partial until a guard uses the prototype. The cheapest way to learn is a 20-minute session with one guard and five printed plates.
