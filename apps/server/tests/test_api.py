import json

import pytest
from fastapi.testclient import TestClient


def add_house(client: TestClient, sid: str, **fields) -> dict:
    body = {"block": "19", "lot": "4", "ownerName": "Juan Dela Cruz", "plate": "NBC 1234"} | fields
    response = client.post(f"/api/subdivisions/{sid}/houses", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def scan_with_plate(client: TestClient, sid: str, monkeypatch, reading: str | None) -> dict:
    monkeypatch.setattr("guardhouse.routes.gate.mock_read_plate", lambda _frame: reading)
    response = client.post(f"/api/subdivisions/{sid}/scan")
    assert response.status_code == 200, response.text
    return response.json()


def test_provider_list_shows_counts_only(client, sid):
    add_house(client, sid)
    [row] = client.get("/api/subdivisions").json()
    assert row == {
        "id": sid,
        "name": "Villa Maranao",
        "address": "Fictional Rd",
        "active": True,
        "cameraOnline": row["cameraOnline"],
        "houseCount": 1,
        "entriesLast7Days": 0,
        "dailyEntries": [0] * 7,
    }


def test_house_labels_and_normalized_plate(client, sid):
    house = add_house(client, sid)
    assert house["label"] == "Block 19 Lot 4"
    assert house["residenceLabel"] == "Dela Cruz Residence"
    assert house["vehicle"] == {"plate": "NBC1234", "plateDisplay": "NBC 1234"}


def test_plate_is_unique_per_subdivision(client, sid):
    add_house(client, sid)
    response = client.post(
        f"/api/subdivisions/{sid}/houses",
        json={"block": "2", "lot": "1", "ownerName": "Ana Reyes", "plate": "nbc-1234"},
    )
    assert response.status_code == 409
    assert "plate" in response.json()["detail"]


def test_houses_are_scoped_to_their_subdivision(client, sid):
    add_house(client, sid)
    other = client.post(
        "/api/subdivisions", json={"name": "Other", "cameraUrl": "http://other.local"}
    ).json()["id"]
    assert client.get(f"/api/subdivisions/{other}/houses").json() == []
    add_house(client, other)  # the same plate is fine in another subdivision


def test_remove_vehicle_with_null_plate(client, sid):
    house = add_house(client, sid)
    response = client.patch(f"/api/subdivisions/{sid}/houses/{house['id']}", json={"plate": None})
    assert response.json()["vehicle"] is None


def test_scan_suggests_near_matches(client, sid, monkeypatch):
    add_house(client, sid)
    detection = scan_with_plate(client, sid, monkeypatch, "NBC 1235")
    assert [s["plate"] for s in detection["suggestions"]] == ["NBC1234"]
    assert detection["suggestions"][0]["distance"] == 1
    assert [d["id"] for d in client.get(f"/api/subdivisions/{sid}/waiting").json()] == [
        detection["id"]
    ]


def test_continuous_mode_keeps_an_unregistered_plate_reading(client, sid, monkeypatch):
    monkeypatch.setattr("guardhouse.gate.mock_read_plate", lambda _frame: "NBC 1234")
    gates = client.app.state.gates

    client.portal.call(gates._continuous_detection, sid)
    client.portal.call(gates._continuous_detection, sid)

    waiting = client.get(f"/api/subdivisions/{sid}/waiting").json()
    assert len(waiting) == 1
    assert waiting[0]["source"] == "continuous"
    assert waiting[0]["plateReading"] == "NBC 1234"
    assert waiting[0]["suggestions"] == []


def test_confirm_registered_saves_entry(client, sid, monkeypatch):
    add_house(client, sid)
    detection = scan_with_plate(client, sid, monkeypatch, "NBC 1235")
    result = client.post(
        f"/api/subdivisions/{sid}/detections/{detection['id']}/confirm", json={"plate": "NBC 1234"}
    ).json()
    assert result["verdict"] == "registered"
    assert result["entry"]["plate"] == "NBC1234"
    assert result["entry"]["plateRaw"] == "NBC 1235"
    assert result["entry"]["houseLabel"] == "Block 19 Lot 4, Juan Dela Cruz"
    assert client.get(f"/api/subdivisions/{sid}/waiting").json() == []


def test_confirm_visitor_saves_nothing_until_form(client, sid, monkeypatch):
    house = add_house(client, sid)
    detection = scan_with_plate(client, sid, monkeypatch, "XYZ 9876")
    result = client.post(
        f"/api/subdivisions/{sid}/detections/{detection['id']}/confirm", json={"plate": "XYZ 9876"}
    ).json()
    assert result == {"verdict": "visitor", "plate": "XYZ9876", "entry": None, "house": None}
    assert client.get(f"/api/subdivisions/{sid}/entries").json() == []

    response = client.post(
        f"/api/subdivisions/{sid}/entries/visitor",
        data={
            "detectionId": detection["id"],
            "plate": "XYZ 9876",
            "purpose": "guest",
            "destination": json.dumps({"kind": "residence", "houseId": house["id"]}),
        },
        files={"idPhoto": ("id.jpg", b"\xff\xd8fake", "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    entry = response.json()
    assert entry["visitor"]["destination"] == {
        "kind": "residence",
        "houseId": house["id"],
        "label": "Dela Cruz Residence",
    }
    assert entry["visitor"]["idPhotoUrl"].startswith("/files/ids/")
    assert client.get(entry["visitor"]["idPhotoUrl"]).content == b"\xff\xd8fake"

    inside = client.get(f"/api/subdivisions/{sid}/entries/inside").json()
    assert [e["id"] for e in inside] == [entry["id"]]
    client.post(f"/api/subdivisions/{sid}/entries/{entry['id']}/return-id")
    assert client.get(f"/api/subdivisions/{sid}/entries/inside").json() == []
    again = client.post(f"/api/subdivisions/{sid}/entries/{entry['id']}/return-id")
    assert again.status_code == 409


def test_editing_a_house_keeps_past_entries(client, sid, monkeypatch):
    house = add_house(client, sid)
    detection = scan_with_plate(client, sid, monkeypatch, "NBC1234")
    client.post(
        f"/api/subdivisions/{sid}/detections/{detection['id']}/confirm", json={"plate": "NBC1234"}
    )
    client.delete(f"/api/subdivisions/{sid}/houses/{house['id']}")
    [entry] = client.get(f"/api/subdivisions/{sid}/entries").json()
    assert entry["houseLabel"] == "Block 19 Lot 4, Juan Dela Cruz"


def test_inactive_subdivision_is_read_only(client, sid, monkeypatch):
    add_house(client, sid)
    client.patch(f"/api/subdivisions/{sid}", json={"active": False})
    assert client.post(f"/api/subdivisions/{sid}/scan").status_code == 409
    assert (
        client.post(
            f"/api/subdivisions/{sid}/houses", json={"block": "1", "lot": "1", "ownerName": "A B"}
        ).status_code
        == 409
    )
    assert client.get(f"/api/subdivisions/{sid}/houses").status_code == 200


def test_entry_log_filters(client, sid, monkeypatch):
    add_house(client, sid)
    for plate in ("NBC1234", "XYZ9876"):
        detection = scan_with_plate(client, sid, monkeypatch, plate)
        client.post(
            f"/api/subdivisions/{sid}/detections/{detection['id']}/confirm", json={"plate": plate}
        )
    log = client.get(f"/api/subdivisions/{sid}/entries", params={"verdict": "registered"}).json()
    assert [e["plate"] for e in log] == ["NBC1234"]
    assert client.get(f"/api/subdivisions/{sid}/entries", params={"plate": "nbc"}).json()
    assert (
        client.get(f"/api/subdivisions/{sid}/entries", params={"date": "2001-01-01"}).json() == []
    )


def confirm_plate(client: TestClient, sid: str, monkeypatch, plate: str) -> dict:
    detection = scan_with_plate(client, sid, monkeypatch, plate)
    response = client.post(
        f"/api/subdivisions/{sid}/detections/{detection['id']}/confirm", json={"plate": plate}
    )
    return detection | {"result": response.json()}


def save_visitor(client: TestClient, sid: str, monkeypatch, plate: str, purpose: str) -> dict:
    detection = confirm_plate(client, sid, monkeypatch, plate)
    response = client.post(
        f"/api/subdivisions/{sid}/entries/visitor",
        data={
            "detectionId": detection["id"],
            "plate": plate,
            "purpose": purpose,
            "destination": json.dumps({"kind": "block", "block": "7"}),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_today_stats(client, sid, monkeypatch):
    add_house(client, sid)
    confirm_plate(client, sid, monkeypatch, "NBC1234")
    save_visitor(client, sid, monkeypatch, "XYZ9876", "guest")
    scan_with_plate(client, sid, monkeypatch, "ABC1111")  # left on the waiting list
    stats = client.get(f"/api/subdivisions/{sid}/stats/today").json()
    assert {k: stats[k] for k in ("entries", "registered", "visitors", "inside", "waiting")} == {
        "entries": 2,
        "registered": 1,
        "visitors": 1,
        "inside": 1,
        "waiting": 1,
    }
    assert [h["hour"] for h in stats["byHour"]] == list(range(24))
    assert sum(h["registered"] + h["visitor"] for h in stats["byHour"]) == 2


def test_hourly_and_purpose_stats(client, sid, monkeypatch):
    save_visitor(client, sid, monkeypatch, "XYZ9876", "delivery")
    hourly = client.get(f"/api/subdivisions/{sid}/stats/hourly", params={"days": 30}).json()
    assert hourly["days"] == 30
    assert sum(h["visitor"] for h in hourly["byHour"]) == 1
    assert (
        client.get(f"/api/subdivisions/{sid}/stats/hourly", params={"days": 10}).status_code == 422
    )

    purposes = client.get(f"/api/subdivisions/{sid}/stats/purposes").json()
    assert purposes["days"] == 7
    assert purposes["purposes"][0] == {"purpose": "delivery", "count": 1}
    assert len(purposes["purposes"]) == 4


def test_provider_sees_last_7_days(client, sid, monkeypatch):
    save_visitor(client, sid, monkeypatch, "XYZ9876", "service")
    [row] = client.get("/api/subdivisions").json()
    assert row["entriesLast7Days"] == 1
    assert row["dailyEntries"] == [0, 0, 0, 0, 0, 0, 1]


def test_dismiss_drops_detection(client, sid, monkeypatch):
    detection = scan_with_plate(client, sid, monkeypatch, None)
    assert detection["plateReading"] is None
    assert client.delete(f"/api/subdivisions/{sid}/detections/{detection['id']}").status_code == 204
    assert client.get(f"/api/subdivisions/{sid}/waiting").json() == []


def test_dismiss_allows_continuous_mode_to_read_same_plate_again(client, sid, monkeypatch):
    monkeypatch.setattr("guardhouse.gate.mock_read_plate", lambda _frame: "ABC 2468")
    gates = client.app.state.gates

    client.portal.call(gates._continuous_detection, sid)
    [first] = client.get(f"/api/subdivisions/{sid}/waiting").json()
    assert client.delete(f"/api/subdivisions/{sid}/detections/{first['id']}").status_code == 204

    client.portal.call(gates._continuous_detection, sid)
    [second] = client.get(f"/api/subdivisions/{sid}/waiting").json()
    assert second["id"] != first["id"]
    assert second["plateReading"] == "ABC 2468"


def test_camera_preview_is_a_jpeg(client, sid):
    response = client.get(f"/api/subdivisions/{sid}/camera/preview")
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content[:2] == b"\xff\xd8"


@pytest.mark.anyio
async def test_mock_camera_plate_reaches_the_reader():
    from guardhouse.camera import MockCamera, mock_read_plate

    async def plates() -> list[str]:
        return ["NBC 1234"]

    for _ in range(10):
        reading = mock_read_plate(await MockCamera(plates).capture())
        assert reading is None or len(reading) == 8
