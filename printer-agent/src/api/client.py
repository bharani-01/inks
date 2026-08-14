"""
Inks API Client
===============
Handles all HTTP communication with the Printa server.
- Session persistence (JWT saved to disk)
- Auto-retry with exponential backoff on transient errors
- Auto-relogin on 401 using .env credentials
"""
import time
import socket
import platform
import threading
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.api.endpoints import Endpoints
from src.config.constants import APP_VERSION
from src.utils.logger import log_info, log_error


class ApiError(Exception):
    """Raised when the API returns a non-2xx response."""
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


class InksApiClient:
    """
    Thread-safe REST API client for the Printer Agent using thread-local sessions.
    """

    def __init__(self, server_url: str, settings=None):
        self.server_url = server_url.rstrip('/')
        self.token: str | None = None
        self.user: dict | None = None
        self._settings = settings
        self._local = threading.local()

    @property
    def _session(self) -> requests.Session:
        if not hasattr(self._local, 'session'):
            session = requests.Session()
            retry = Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[502, 503, 504],
            )
            adapter = HTTPAdapter(max_retries=retry)
            session.mount('http://', adapter)
            session.mount('https://', adapter)
            self._local.session = session
        return self._local.session

    # ──────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _url(self, path: str) -> str:
        return f"{self.server_url}{path}"

    def _headers(self) -> dict:
        h = {
            'Content-Type': 'application/json',
            'X-Agent-Version': APP_VERSION,
        }
        if self.token:
            h['Authorization'] = f'Bearer {self.token}'
        return h

    def _request(self, method: str, path: str, **kwargs) -> dict | bytes:
        """
        Execute an HTTP request. On 401, attempt one silent re-login then retry.
        Returns parsed JSON dict, or raw bytes for binary responses.
        """
        start_t = time.perf_counter()
        url = self._url(path)
        try:
            resp = self._session.request(
                method, url, headers=self._headers(), timeout=20, **kwargs
            )
            elapsed_ms = (time.perf_counter() - start_t) * 1000
            log_info(f"🌐 HTTP {method} {path} → {resp.status_code} ({elapsed_ms:.1f}ms)")
        except Exception as net_err:
            elapsed_ms = (time.perf_counter() - start_t) * 1000
            log_error(f"🌐 HTTP {method} {path} FAILED after {elapsed_ms:.1f}ms: {net_err}")
            raise ApiError(f"Network error connecting to server: {net_err}")

        if resp.status_code == 401 and self._settings and self._settings.agent_email:
            # Try to silently re-login
            try:
                self.login(self._settings.agent_email, self._settings.agent_password)
                resp = self._session.request(
                    method, url, headers=self._headers(), timeout=20, **kwargs
                )
            except Exception:
                pass

        if not resp.ok:
            try:
                msg = resp.json().get('message', resp.text)
            except Exception:
                msg = resp.text or f'HTTP {resp.status_code}'
            raise ApiError(msg, resp.status_code)

        content_type = resp.headers.get('Content-Type', '')
        if 'application/pdf' in content_type or 'octet-stream' in content_type or (resp.content and resp.content.startswith(b'%PDF')):
            return resp.content
        return resp.json()

    # ──────────────────────────────────────────────────────────────────────────
    # Public API methods
    # ──────────────────────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        """
        Authenticate with the Printa server.
        Returns user dict. Raises ApiError on failure.
        """
        data = self._session.post(
            self._url(Endpoints.AUTH_LOGIN),
            json={'email': email, 'password': password},
            timeout=15,
        )
        if not data.ok:
            try:
                msg = data.json().get('message', 'Login failed')
            except Exception:
                msg = 'Login failed'
            raise ApiError(msg, data.status_code)

        result = data.json()
        self.token = result['token']
        self.user = result.get('user', {})

        # Persist token for next launch
        if self._settings:
            self._settings.save_session_token(self.token)

        return result

    def validate_token(self, token: str) -> dict | None:
        """
        Validate a saved JWT token by calling /api/auth/me.
        Returns user dict if valid, None if invalid/expired.
        """
        old_token = self.token
        self.token = token
        try:
            result = self._request('GET', Endpoints.AUTH_ME)
            self.user = result.get('user', result)
            return self.user
        except ApiError:
            self.token = old_token
            return None

    def fetch_pending(self) -> list[dict]:
        """Fetch unprinted, paid orders from the server."""
        result = self._request('GET', Endpoints.AGENT_PENDING)
        return result.get('orders', [])

    def download_pdf(self, order_id: int) -> bytes:
        """Download the print-ready merged PDF for an order."""
        path = Endpoints.ORDER_PRINT_READY.format(id=order_id)
        res = self._request('GET', path)
        if isinstance(res, bytes):
            return res
        msg = res.get('message', f'Server returned non-PDF response') if isinstance(res, dict) else str(res)
        raise ApiError(f"PDF Download failed for order #{order_id}: {msg}")

    def update_order_status(self, order_id: int, status: str) -> bool:
        """Update an order's status (e.g. PROCESSING, PRINTED)."""
        path = Endpoints.ORDER_STATUS.format(id=order_id)
        try:
            self._request('PUT', path, json={'orderStatus': status})
            return True
        except ApiError:
            return False

    def mark_printed(self, order_id: int) -> bool:
        """Mark an order as PRINTED."""
        return self.update_order_status(order_id, 'PRINTED')

    def mark_processing(self, order_id: int) -> bool:
        """Mark an order as PROCESSING."""
        return self.update_order_status(order_id, 'PROCESSING')

    def heartbeat(self, metadata: dict) -> list[dict]:
        """
        Send a heartbeat ping and receive any pending remote commands.
        Returns list of unacknowledged commands.
        """
        try:
            result = self._request('POST', Endpoints.AGENT_HEARTBEAT, json=metadata)
            return result.get('commands', [])
        except Exception:
            return []

    def log_activity(self, action: str, **kwargs) -> bool:
        """Post an activity log entry to Supabase."""
        try:
            self._request('POST', Endpoints.AGENT_LOG, json={
                'action': action,
                **kwargs,
            })
            return True
        except Exception:
            return False

    def ack_command(self, command_id: int) -> bool:
        """Acknowledge a remote command after executing it."""
        try:
            path = Endpoints.AGENT_CMD_ACK.format(id=command_id)
            self._request('POST', path)
            return True
        except Exception:
            return False

    def disconnect(self) -> None:
        """Notify server of graceful disconnect."""
        try:
            self._request('POST', Endpoints.AGENT_DISCONNECT)
        except Exception:
            pass
        self.token = None
        self.user = None

    def build_heartbeat_metadata(self, extra: dict = None) -> dict:
        """Build the metadata payload for a heartbeat request."""
        data = {
            'agentVersion': APP_VERSION,
            'hostname': socket.gethostname(),
            'osName': platform.system(),
        }
        if extra:
            data.update(extra)
        return data
