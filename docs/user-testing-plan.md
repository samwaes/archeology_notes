# User testing plan

Updated: 2026-08-15

## Status

Archeology Notes is **in user testing**.

The next work is not another broad feature phase. It is a structured pilot with archaeologists, conservators and heritage documentation users.

Testing contact and access requests: `samwaes@gmail.com`.

## Tester onboarding

A new tester should be able to start without a live walkthrough.

The onboarding path is:

1. open the Home page
2. understand the stated purpose and intended audience
3. read the five-step Quick Start summary
4. download the Quick Start PDF if useful
5. use the full User Manual only when more detail is needed
6. start with Projects or Field capture

The manuals are available from Home and are stored as private R2 documentation assets. The Access page also shows the test-contact email for users who do not yet have application access.

Observe whether a tester can identify what the product is for and where to start within two minutes.

## Test strategy

Focus on professional workflow value rather than point-cloud performance. Dense point-cloud and repeated-survey tests remain parked until suitable datasets are available.

Do not mainly ask whether users like the interface. Give them realistic tasks and observe whether they can complete them without explanation.

## Scenario 1: evidence and Catalog

Ask the tester to:

1. open a project
2. add several photographs/documents in one bulk upload
3. link them to a Site or Physical Object
4. find one record again using Catalog filters
5. find another through global Search
6. edit one record
7. export the Catalog CSV

Observe:

- whether Project, Site and Physical Object are understandable
- whether the amount of metadata feels useful or administrative
- which Catalog columns matter
- whether search vocabulary matches professional terminology
- whether bulk intake reduces friction compared with the tester's existing workflow

## Scenario 2: conservation chain

Ask a conservation professional to:

1. select a real Site/Object context
2. create a condition assessment
3. choose category, severity, confidence and treatment priority
4. create an intervention that addresses the condition
5. document method and materials
6. link one existing photograph/record as before evidence
7. add or select after evidence
8. inspect the resulting record detail and timeline
9. export the conservation CSV

Observe:

- whether observation, condition and intervention are naturally distinct
- whether severity/confidence/priority terminology is appropriate
- which condition categories should become controlled vocabularies versus free text
- whether before/after evidence linking is sufficiently explicit
- whether the timeline helps reconstruct conservation history
- what a professional report needs beyond the current CSV export

## Scenario 3: mobile field capture online

On a phone, ask the tester to capture at least ten mixed records:

- photos
- notes
- observations
- one measurement
- one voice note
- GPS where useful

Verify that Project/Site/Object context stays selected between captures and that records can be refined later rather than requiring full cataloguing onsite.

## Scenario 4: offline field operation

Prepare the Field workspace once while online, then deliberately remove connectivity.

Ask the tester to:

1. reopen Field where the device/browser supports the cached shell
2. capture a note
3. capture a photograph
4. capture a voice note
5. confirm the device queue shows the records
6. close and reopen the app/browser
7. confirm queued evidence remains on the device
8. restore connectivity
9. allow automatic sync or press Sync now
10. verify each item appears once in the server-backed Field inbox/Catalog

Then deliberately create one conflict by changing/removing the relevant server context before sync. Verify that the queued item remains visible and can be retried with the current context or explicitly discarded.

Important: offline evidence is not considered server-preserved until successful sync is confirmed.

## Scenario 5: photographic spatial round trip

Using Casignana:

1. navigate the photographic model
2. click a physical location
3. create a spatial observation
4. open the Catalog record
5. use Show in 3D
6. confirm the viewer returns to the same spatial context

Observe whether photographic 3D improves orientation and evidence retrieval enough to justify the extra interface complexity.

## Scenario 6: two-user permissions

With two Hupla-authorised users:

1. both join the same pilot project
2. user A creates a Project-visible record
3. user B verifies they can read it
4. user A creates a Private record
5. user B verifies it is not visible
6. test owner/admin versus contributor editing
7. repeat with one condition/intervention record

## What to measure

Capture:

- whether Home explains the product without assistance
- time to first useful record
- task completion without help
- time for repeated field captures
- number of corrections needed after field capture
- navigation dead ends
- vocabulary corrections
- missing metadata
- duplicate or failed offline sync attempts
- whether users return to Catalog, Conservation or 3D naturally for different tasks
- which existing spreadsheet/document/photo-folder workflow the product could replace, if any
- which manual sections are actually used

## Feedback format

For useful pilot feedback, record:

- user role and context
- task attempted
- result: completed / completed with help / failed
- point of friction
- exact terminology or metadata problem
- workaround used outside Archeology Notes
- severity: cosmetic / slows work / blocks work / evidence risk
- suggested change, if the tester has one

## Decision rule

Do not add large features because one tester requests them. Prioritise changes that repeatedly remove observed workflow friction, protect evidence/provenance or make the project understandable without explanation.

The first pilot milestone is complete when several real users have completed the core evidence, field, conservation and spatial tasks and the findings can be converted into a prioritised testing report.
