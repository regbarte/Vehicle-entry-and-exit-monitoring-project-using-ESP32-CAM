import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from guardhouse.main import create_app
from guardhouse.settings import Settings

TEST_DB = "guardhouse_test"


@pytest.fixture
def client():
    settings = Settings(mongo_db=TEST_DB, data_dir=Path(tempfile.mkdtemp()), mock_camera=True)
    MongoClient(settings.mongo_uri).drop_database(TEST_DB)
    with TestClient(create_app(settings)) as test_client:
        yield test_client
    MongoClient(settings.mongo_uri).drop_database(TEST_DB)


@pytest.fixture
def sid(client: TestClient) -> str:
    response = client.post(
        "/api/subdivisions",
        json={
            "name": "Villa Maranao",
            "address": "Fictional Rd",
            "cameraUrl": "http://guardcam.local",
        },
    )
    return response.json()["id"]
