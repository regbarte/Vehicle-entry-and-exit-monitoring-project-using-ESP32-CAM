# Intent: guardhouse vehicle check
Author: Wendell Terence Dador. Status: draft.

## Problem
Guards at the subdivision gate check each arriving car by eye. They tell a resident's car from a visitor's by memory, and they write visitor details by hand in a logbook.
The logbook is slow to fill in at the gate and hard to search later.

## Proposed outcome
An ESP32-CAM at the guardhouse photographs each arriving car, and the system reads its plate. The guard confirms or corrects the plate.
A registered car shows its house and owner. A car that is not registered opens the visitor form with an ID photo, the purpose, and the destination. The guard records the visitor's exit when returning the ID.
The system runs in continuous mode: the camera sends a photo about once a second, and the system reads the plate of each arriving car without a click. The guard can still click Scan to read a plate that continuous mode missed.
The HOA officer registers houses and vehicles. The provider, the team that runs the system, adds and manages the subdivisions that use it.
See docs/architecture.md for the technical design.

## Affected users and systems
Guard, HOA officer, provider. ESP32-CAM, guardhouse laptop running the server, MongoDB and the dashboard, laptop webcam.

## Constraints
Prototype, demonstrated with printed plates. Runs offline on one laptop; the ESP32-CAM joins the laptop's hotspot.
One local server holds every subdivision. Each house and entry belongs to one subdivision, and each subdivision has one gate.
The camera is mounted at a fixed spot where cars slow down or stop, so each plate appears at about the same size and angle.
The root page is a role picker with no passwords. Guards and HOA officers then pick their subdivision. The role is not a security control.
The provider sees each subdivision's status and counts, never its houses, entries or photos.
An inactive subdivision's records stay viewable, but its guard and HOA officer cannot save entries or change the registry.
MicroPython firmware, Python (FastAPI) server, MongoDB, Vite and React dashboard, OpenCV plate detection behind an interface that a trained model replaces later, with Tesseract OCR.
The guard confirms every plate before an entry is saved.
One registered vehicle per house, and a plate at most once per subdivision. The registry lists every house, with or without a car. The HOA officer maintains it in the dashboard; it has no expiry dates and is read-only for the guard. There is no seed file.
Each entry keeps a copy of its plate and destination as they were when saved. Editing or removing a house never changes past entries. Each house shows when it was last updated.
Only visitors have exits. The real product deletes ID photos 30 days after the visitor's exit (Data Privacy Act, RA 10173). The prototype has no sweeper; the team deletes old photos by hand. Use fictional data in tests and demos.
Out of scope: gate or barrier control, resident notifications, exits for registered cars, business model and billing, logins and passwords (users are stored, but the role picker still decides who you are).

## Open questions
Which dataset trains the plate model: a public plate dataset, our own ESP32-CAM photos, or both?
Which operating system will the guardhouse laptop run?
What plate-reading accuracy does the demo need?
How do we create test and demo data, now that there is no seed file?
Can a guard still return a held ID after the subdivision is deactivated?
