"""
Constants — app-wide fixed values.
"""

APP_NAME = "Inks Printer Agent"
APP_VERSION = "1.0.0"
APP_SUBTITLE = "Secure Print Station"
APP_FOOTER = f"v{APP_VERSION} · Inks by Trackify"

HEARTBEAT_INTERVAL_MS = 30_000   # 30 seconds
MIN_POLL_INTERVAL = 5             # seconds
MAX_POLL_INTERVAL = 60            # seconds
DEFAULT_POLL_INTERVAL = 10        # seconds
AUTO_PRINT_DELAY = 10             # seconds

SESSION_FILE_NAME = ".inks_agent_session"

WINDOW_MIN_WIDTH  = 960
WINDOW_MIN_HEIGHT = 650
WINDOW_WIDTH      = 1100
WINDOW_HEIGHT     = 720

SIDEBAR_WIDTH = 200

VALID_COMMANDS = [
    'PAUSE', 'RESUME', 'FORCE_POLL', 'CHANGE_PRINTER',
    'DISCONNECT', 'PRINT_ORDER', 'SET_AUTO_MODE', 'CHANGE_POLL_INTERVAL',
]
