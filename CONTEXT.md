# Guardhouse vehicle monitor

A camera at a subdivision guardhouse reads the plate of each arriving car. The guard checks the car against the subdivision's registry, and records anyone who is not registered. One system serves many subdivisions.

## Language

### People and places

**Subdivision**:
A gated community that uses the system. It has one gate, its own registry and its own entries, and is either active or inactive.
_Avoid_: Village, community, tenant, site

**Inactive subdivision**:
A subdivision the provider deactivated. Its guard and HOA officer can still view its records, but cannot save entries or change its registry.
_Avoid_: Suspended, disabled

**Guard**:
The security guard on duty at a subdivision's guardhouse.
_Avoid_: Operator, user

**HOA officer**:
An officer or staff member of a subdivision's homeowners' association. Maintains the subdivision's registry and views its entries.
_Avoid_: Admin, HOA (the association, not the person)

**Provider**:
The team that built and runs the system for many subdivisions. Sees each subdivision's status and counts, never its houses, entries or photos.
_Avoid_: Developer (in real estate, the company that built the subdivision), platform admin, admin

**House**:
A home in a subdivision, identified by its block and lot.
_Avoid_: Household, unit, property

**Block**:
A group of lots in a subdivision, named by number. A visitor's destination can be a block. The Grid screen draws each block as a cluster of houses.
_Avoid_: Street, phase, section

**Grid**:
The HOA officer's picture of the subdivision: every house as a bar or square, sized by its entries.
_Avoid_: Map, heatmap

**Owner**:
The registered owner of a house, or the representative the owner named.
_Avoid_: Homeowner, resident, member

### Vehicles

**Registry**:
A subdivision's list of houses, each with its owner and at most one registered vehicle. The HOA officer maintains it; the guard can only search it.
_Avoid_: Masterlist, database

**Registered vehicle**:
A car in a subdivision's registry, tied to one house and its owner. Each house has at most one, and a plate appears at most once per subdivision.
_Avoid_: Resident car, member vehicle, pass

**Visitor**:
The driver of a car whose plate is not in the registry.
_Avoid_: Guest (that is a purpose), unregistered, outsider

### At the gate

**Scan**:
The guard's request for one photo from the gate camera. The backup for a car that continuous mode missed.
_Avoid_: Capture, snap

**Continuous mode**:
The normal way the gate works: the gate camera sends a photo about once a second and the system looks for plates on its own.
_Avoid_: Auto mode, live detection

**Detection**:
One car's plate, found and read by the system. In continuous mode it combines the readings from several photos of the same car; a scan uses one photo.
_Avoid_: Hit, scan result

**Plate reading**:
The plate text the system read from a detection, before the guard confirms it.
_Avoid_: OCR result

**Near match**:
A registered plate that differs from the plate reading by one character, offered to the guard as a suggestion.
_Avoid_: Fuzzy match, guess

**Confirmed plate**:
The plate number after the guard has checked, and if needed corrected, the plate reading.

**Verdict**:
Whether a confirmed plate is in the registry. Shown as "Registered" or "Not registered".
_Avoid_: Status, result

**Entry**:
One record of a car coming in, created when the guard confirms a detection.
_Avoid_: Log, visit, record

**Waiting list**:
Detections that arrived while the guard was still handling an earlier one.
_Avoid_: Queue, backlog

**Purpose**:
Why a visitor is entering: delivery, guest, service, or other.

**Destination**:
Where a visitor is going: a block or a residence. Delivery riders usually give a block; guests usually give a residence.

**Residence**:
A house named as a visitor's destination, picked from the registry and shown with the owner's family name, for example "Dela Cruz Residence".
_Avoid_: Residency

**ID photo**:
A webcam photo of the visitor's driver's license, or another ID if they have none.
_Avoid_: License picture, ID scan

**Held ID**:
The ID the guard keeps while the visitor is inside the subdivision.
_Avoid_: Surrendered ID, deposit

**Exit**:
The moment the guard returns a visitor's held ID. Only visitors have exits.
_Avoid_: Checkout, logout, time out
