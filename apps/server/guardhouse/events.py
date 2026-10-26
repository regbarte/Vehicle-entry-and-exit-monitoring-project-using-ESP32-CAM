import asyncio
from collections import defaultdict

from guardhouse.models import CameraEvent, DetectionEvent, EntryEvent

Event = DetectionEvent | EntryEvent | CameraEvent


class EventHub:
    """Fans out live updates to every open dashboard of a subdivision.

    In memory, so the server runs as one worker process.
    """

    def __init__(self) -> None:
        self._subscribers: defaultdict[str, set[asyncio.Queue[Event]]] = defaultdict(set)

    def subscribe(self, sid: str) -> asyncio.Queue[Event]:
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=100)
        self._subscribers[sid].add(queue)
        return queue

    def unsubscribe(self, sid: str, queue: asyncio.Queue[Event]) -> None:
        self._subscribers[sid].discard(queue)

    def publish(self, sid: str, event: Event) -> None:
        for queue in self._subscribers[sid]:
            # A dashboard that stops reading loses events; it refetches on reconnect.
            if not queue.full():
                queue.put_nowait(event)
