"""Day and hour boundaries in the laptop's local time. Stored times stay in UTC."""

from datetime import UTC, date, datetime, time, timedelta, tzinfo


def local_tz() -> tzinfo:
    return datetime.now().astimezone().tzinfo or UTC


def local_today() -> date:
    return datetime.now(local_tz()).date()


def local_date(at: datetime) -> date:
    return at.astimezone(local_tz()).date()


def local_hour(at: datetime) -> int:
    return at.astimezone(local_tz()).hour


def start_of_day(day: date) -> datetime:
    """Local midnight of `day`, in UTC."""
    return datetime.combine(day, time(), local_tz()).astimezone(UTC)


def window_start(days: int) -> datetime:
    """Local midnight `days - 1` days ago, so the window is today plus the days before it."""
    return start_of_day(local_today() - timedelta(days=days - 1))
