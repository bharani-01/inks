"""
Settings — loads from .env file with sensible defaults.
Persists last-used values to a local JSON cache file.
"""
import os
import json
from pathlib import Path
from dataclasses import dataclass, field, asdict
from dotenv import load_dotenv

from src.config.constants import APP_VERSION, SESSION_FILE_NAME, DEFAULT_POLL_INTERVAL

# Load .env from the agent root directory
_AGENT_ROOT = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=_AGENT_ROOT / '.env', override=False)

# Local JSON cache stored in the user's home dir (persists across restarts)
_CACHE_PATH = Path.home() / '.inks_printer_agent.json'
# Session token stored separately (encrypted/separate for security)
SESSION_PATH = Path.home() / SESSION_FILE_NAME


@dataclass
class Settings:
    server_url: str       = 'http://localhost:3000'
    agent_email: str      = ''
    agent_password: str   = ''
    poll_interval: int    = DEFAULT_POLL_INTERVAL
    auto_print: bool      = False
    auto_print_delay: int = 10
    sound_alerts: bool    = True
    minimize_to_tray: bool = True
    printer_name: str     = ''
    save_folder: str      = ''
    agent_version: str    = APP_VERSION

    def save(self):
        """Persist non-sensitive settings to local JSON cache."""
        data = asdict(self)
        data.pop('agent_password', None)   # Never persist password
        try:
            _CACHE_PATH.write_text(json.dumps(data, indent=2))
        except Exception:
            pass

    def save_session_token(self, token: str):
        """Persist JWT token to session file."""
        try:
            SESSION_PATH.write_text(token)
        except Exception:
            pass

    def load_session_token(self) -> str | None:
        """Load saved JWT token from session file."""
        try:
            if SESSION_PATH.exists():
                token = SESSION_PATH.read_text().strip()
                return token if token else None
        except Exception:
            pass
        return None

    def clear_session_token(self):
        """Delete the saved session token."""
        try:
            if SESSION_PATH.exists():
                SESSION_PATH.unlink()
        except Exception:
            pass


def load_settings() -> Settings:
    """
    Build Settings by merging (priority order):
      1. .env file values (highest priority)
      2. Local JSON cache values
      3. Dataclass defaults (lowest priority)
    """
    s = Settings()

    # Load from local JSON cache first
    if _CACHE_PATH.exists():
        try:
            cached = json.loads(_CACHE_PATH.read_text())
            for key, val in cached.items():
                if hasattr(s, key) and key != 'agent_password':
                    setattr(s, key, val)
        except Exception:
            pass

    # Override with .env values (higher priority)
    _env_map = {
        'INKS_SERVER_URL':       ('server_url',      str),
        'INKS_AGENT_EMAIL':      ('agent_email',     str),
        'INKS_AGENT_PASSWORD':   ('agent_password',  str),
        'INKS_POLL_INTERVAL':    ('poll_interval',   int),
        'INKS_AUTO_PRINT':       ('auto_print',      lambda v: v.lower() == 'true'),
        'INKS_AUTO_PRINT_DELAY': ('auto_print_delay',int),
        'INKS_SOUND_ALERTS':     ('sound_alerts',    lambda v: v.lower() == 'true'),
        'INKS_MINIMIZE_TO_TRAY': ('minimize_to_tray',lambda v: v.lower() == 'true'),
        'INKS_PRINTER_NAME':     ('printer_name',    str),
        'INKS_SAVE_FOLDER':      ('save_folder',     str),
        'INKS_AGENT_VERSION':    ('agent_version',   str),
    }

    for env_key, (attr, cast) in _env_map.items():
        val = os.getenv(env_key)
        if val is not None and val.strip() != '':
            try:
                setattr(s, attr, cast(val))
            except Exception:
                pass

    # Default save folder to Desktop/PrintQueue
    if not s.save_folder:
        s.save_folder = str(Path.home() / 'Desktop' / 'PrintQueue')

    return s
