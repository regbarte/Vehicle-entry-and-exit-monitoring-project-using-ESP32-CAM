from pathlib import Path

from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    TomlConfigSettingsSource,
)

SERVER_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=SERVER_DIR / ".env",
        toml_file=SERVER_DIR / "config.toml",
        extra="ignore",
    )

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "guardhouse"
    data_dir: Path = SERVER_DIR / "data"

    repeat_window_seconds: int = 30
    continuous_mode_enabled: bool = True
    continuous_interval_seconds: float = 1.0
    capture_resolution: str = "UXGA"
    capture_timeout_seconds: float = 20.0
    flash_dark_threshold: float = 35.0
    flash_settle_seconds: float = 0.6
    near_match_distance: int = 1
    camera_poll_seconds: float = 5.0
    mock_camera: bool = True
    barrier_port: str = ""
    barrier_subdivision_id: str = ""

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            TomlConfigSettingsSource(settings_cls),
        )


settings = Settings()
