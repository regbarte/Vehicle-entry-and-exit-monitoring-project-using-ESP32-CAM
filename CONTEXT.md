# Guardhouse vehicle monitor

A camera at a subdivision guardhouse reads the plate of each arriving car. The guard checks the car against the community's registry, and records anyone who is not registered.

## Language

### People and places

**Guard**:
The security guard on duty at the guardhouse. The main person who uses the dashboard.
_Avoid_: Operator, user

**Admin**:
A second dashboard role. Its duties are not defined yet.
_Avoid_: Supervisor, superuser

**House**:
A home in the subdivision, identified by its block and lot.
_Avoid_: Household, unit, property

**Owner**:
The registered owner of a house, or the representative the owner named.
_Avoid_: Homeowner, resident, member

### Vehicles

**Registry**:
The community's list of houses, each with its owner and at most one registered vehicle. The team loads it from a seed file; the guard can only search it.
_Avoid_: Masterlist, database

**Registered vehicle**:
A car in the registry, tied to one house and its owner. Each house has at most one.
_Avoid_: Resident car, member vehicle, pass

**Visitor**:
The driver of a car whose plate is not in the registry.
_Avoid_: Guest (that is a purpose), unregistered, outsider

### At the gate

**Scan**:
The guard's request for one photo from the gate camera.
_Avoid_: Capture, snap

**Continuous mode**:
A setting in which the gate camera sends a photo about once a second and the system looks for plates on its own.
_Avoid_: Auto mode, live detection

**Detection**:
One photo in which the system found a plate and read it, started by a scan or by continuous mode.
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
