from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from guardhouse.db import Database
from guardhouse.events import EventHub
from guardhouse.gate import Gates, camera_poller
from guardhouse.routes import entries, gate, houses, stats, subdivisions, users
from guardhouse.settings import Settings, settings


def create_app(config: Settings = settings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(config.mongo_uri, config.mongo_db)
        await db.create_indexes()
        app.state.settings = config
        app.state.db = db
        app.state.hub = EventHub()
        app.state.gates = Gates(db, app.state.hub, config)
        async with camera_poller(app.state.gates):
            yield
        await db.close()

    app = FastAPI(title="Guardhouse", version="0.1.0", lifespan=lifespan)
    app.include_router(subdivisions.router)
    app.include_router(gate.router)
    app.include_router(entries.router)
    app.include_router(houses.router)
    app.include_router(stats.router)
    app.include_router(users.router)

    config.data_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/files", StaticFiles(directory=config.data_dir), name="files")
    return app


app = create_app()
