"""
Poll Service
============
Background thread that polls the server for new print jobs
at a configurable interval.
"""
import threading
import time
import queue
from typing import Callable


class PollService:
    """
    Runs a daemon thread that polls for pending orders.
    Communicates with the UI via a thread-safe queue.
    """

    def __init__(
        self,
        api_client,
        event_queue: queue.Queue,
        interval_seconds: int = 10,
    ):
        self._api = api_client
        self._queue = event_queue
        self._interval = interval_seconds
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._paused = threading.Event()
        self._force_poll = threading.Event()

    # ── Public control methods ─────────────────────────────────────────────────

    def start(self):
        """Start the background polling thread."""
        self._stop_event.clear()
        self._paused.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Gracefully stop the polling thread."""
        self._stop_event.set()
        self._force_poll.set()   # Wake up sleeping thread immediately

    def pause(self):
        self._paused.set()
        self._queue.put({'type': 'STATUS', 'value': 'paused'})

    def resume(self):
        self._paused.clear()
        self._force_poll.set()   # Trigger an immediate poll on resume
        self._queue.put({'type': 'STATUS', 'value': 'running'})

    def force_poll_now(self):
        """Immediately trigger a poll without waiting for the interval."""
        self._force_poll.set()

    def set_interval(self, seconds: int):
        self._interval = max(5, int(seconds))

    @property
    def is_paused(self) -> bool:
        return self._paused.is_set()

    # ── Internal loop ──────────────────────────────────────────────────────────

    def _loop(self):
        while not self._stop_event.is_set():
            # If paused, wait until resumed or stopped
            if self._paused.is_set():
                self._stop_event.wait(timeout=1)
                continue

            self._do_poll()

            # Sleep for the poll interval, but can be interrupted early
            self._force_poll.clear()
            self._force_poll.wait(timeout=self._interval)

    def _do_poll(self):
        """Execute one poll cycle."""
        try:
            self._queue.put({'type': 'POLL_START'})
            orders = self._api.fetch_pending()
            self._queue.put({'type': 'ORDERS', 'orders': orders})
        except Exception as e:
            self._queue.put({'type': 'ERROR', 'message': str(e)})

        # Check heartbeat + fetch remote commands
        try:
            metadata = self._api.build_heartbeat_metadata()
            commands = self._api.heartbeat(metadata)
            if commands:
                self._queue.put({'type': 'COMMANDS', 'commands': commands})
        except Exception:
            pass
