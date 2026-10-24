# Intent: guardhouse vehicle check
Author: Wendell Terence Dador. Status: draft.

## Problem
Guards at the subdivision gate check each arriving car by eye. They tell a resident's car from a visitor's by memory, and they write visitor details by hand in a logbook.
The logbook is slow to fill in at the gate and hard to search later.

## Proposed outcome
An ESP32-CAM at the guardhouse photographs each arriving car, and the system reads its plate. The guard confirms or corrects the plate.
A registered car shows its house and owner. A car that is not registered opens the visitor form with an ID photo, the purpose, and the destination. The guard records the visitor's exit when returning the ID.
The first version reads a plate when the guard clicks Scan. A later version adds continuous mode, which reads plates without a click.

## Affected users and systems
Guard, admin (role not yet defined). ESP32-CAM, guardhouse laptop running the server, MongoDB and the dashboard, laptop webcam.

## Constraints
Prototype, demonstrated with printed plates. Runs offline on one laptop; the ESP32-CAM joins the laptop's hotspot.
MicroPython firmware, Python (FastAPI) server, MongoDB, Vite and React dashboard, a trained plate model with Tesseract OCR.
The guard confirms every plate before an entry is saved.
One registered vehicle per house. The registry comes from a seed file, has no expiry dates, and is read-only for the guard.
Only visitors have exits. ID photos are deleted 30 days after the visitor's exit (Data Privacy Act, RA 10173). Use fictional data in seeds, tests and demos.
Out of scope: gate or barrier control, resident notifications, exits for registered cars.

## Open questions
What can the admin do?
Which dataset trains the plate model: a public plate dataset, our own ESP32-CAM photos, or both?
Does the guard type the destination, or pick it from the registry's blocks and houses?
Which operating system will the guardhouse laptop run?
What plate-reading accuracy does the demo need?
