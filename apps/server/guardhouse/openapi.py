"""Write openapi.json for `bun run gen:types`."""

import json

from guardhouse.main import app
from guardhouse.settings import SERVER_DIR

if __name__ == "__main__":
    (SERVER_DIR / "openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
