"""The boom barrier: an Arduino on the laptop's USB port.

The Arduino reads OPEN, CLOSE and STATUS lines and answers STATE:OPEN or
STATE:CLOSED after every change, including presses of its own button.
"""

import asyncio
import logging

import serial

from guardhouse.events import EventHub
from guardhouse.models import BarrierEvent, BarrierState

log = logging.getLogger(__name__)

STATES: dict[str, BarrierState] = {"STATE:OPEN": "open", "STATE:CLOSED": "closed"}


class Barrier:
    def __init__(self, port: str, sid: str, hub: EventHub) -> None:
        self.port = port
        self.sid = sid
        self._hub = hub
        self._serial: serial.Serial | None = None
        self.state: BarrierState = "closed" if not port else "unknown"

    def _set(self, state: BarrierState) -> None:
        self.state = state
        self._hub.publish(self.sid, BarrierEvent(type="barrier", state=state))

    async def send(self, command: str) -> None:
        if not self.port:
            # No Arduino: pretend, so the dashboard works without hardware.
            self._set("open" if command == "OPEN" else "closed")
            return
        if self._serial is None:
            raise ConnectionError("The barrier is not connected")
        await asyncio.to_thread(self._serial.write, f"{command}\n".encode())

    async def run(self) -> None:
        """Keep the port open and publish every state change. Reconnects if unplugged."""
        if not self.port:
            return
        while True:
            try:
                self._serial = await asyncio.to_thread(serial.Serial, self.port, 9600, timeout=1)
                await asyncio.sleep(2)  # opening the port resets the Arduino
                await self.send("STATUS")
                while True:
                    raw = await asyncio.to_thread(self._serial.readline)
                    line = raw.decode(errors="ignore").strip()
                    if line in STATES:
                        self._set(STATES[line])
            except serial.SerialException:
                log.warning("The barrier on %s is not answering; retrying", self.port)
                self._set("unknown")
            finally:
                if self._serial is not None:
                    self._serial.close()
                    self._serial = None
            await asyncio.sleep(3)
