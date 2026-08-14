"""
Login Frame
===========
Full-screen centered login card shown before authentication.
Supports: server URL, email, password.
Auto-validates saved session token on load.
"""
import tkinter as tk
from tkinter import messagebox

from src.ui.theme import C, FONT, SPACE
from src.ui.widgets.components import (
    PremiumButton, Card, StatusDot, LabeledInput, Divider
)
from src.config.constants import APP_NAME, APP_SUBTITLE, APP_FOOTER


class LoginFrame(tk.Frame):

    def __init__(self, parent, on_login_success, settings, api_client):
        super().__init__(parent, bg=C['bg_app'])
        self._on_success = on_login_success
        self._settings   = settings
        self._api        = api_client
        self._connecting = False

        self._build()

    # ── Build UI ───────────────────────────────────────────────────────────────

    def _build(self):
        # Center vertically
        self.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)

        # Outer centering frame
        center = tk.Frame(self, bg=C['bg_app'])
        center.grid(row=0, column=0)

        # App title above the card
        tk.Label(
            center,
            text='🖨',
            font=('Segoe UI Emoji', 32),
            bg=C['bg_app'],
            fg=C['accent'],
        ).pack(pady=(0, 4))

        tk.Label(
            center,
            text=APP_NAME,
            font=FONT['h1'],
            bg=C['bg_app'],
            fg=C['text_primary'],
        ).pack()

        tk.Label(
            center,
            text=APP_SUBTITLE,
            font=FONT['body'],
            bg=C['bg_app'],
            fg=C['text_secondary'],
        ).pack(pady=(2, 20))

        # ── Login Card ────────────────────────────────────────────────────────
        card = Card(center)
        card.pack(ipadx=32, ipady=28, padx=0)

        inner = tk.Frame(card, bg=C['bg_card'])
        inner.pack(padx=28, pady=24, fill='x')

        # Server URL
        self._server_input = LabeledInput(inner, label='Server URL', bg=C['bg_card'])
        self._server_input.set(self._settings.server_url)
        self._server_input.pack(fill='x', pady=(0, SPACE['md']))

        # Email
        self._email_input = LabeledInput(inner, label='Email Address', bg=C['bg_card'])
        self._email_input.set(self._settings.agent_email)
        self._email_input.pack(fill='x', pady=(0, SPACE['md']))

        # Password
        self._pw_input = LabeledInput(inner, label='Password', show='•', bg=C['bg_card'])
        self._pw_input.pack(fill='x', pady=(0, SPACE['lg']))
        self._pw_input.bind_return(lambda *e: self._do_login())

        # Status line
        self._status_row = tk.Frame(inner, bg=C['bg_card'])
        self._status_row.pack(fill='x', pady=(0, SPACE['md']))

        self._dot = StatusDot(self._status_row, status='offline', bg=C['bg_card'])
        self._dot.pack(side='left', padx=(0, 6))

        self._status_lbl = tk.Label(
            self._status_row,
            text='Not connected',
            font=FONT['body_sm'],
            fg=C['text_tertiary'],
            bg=C['bg_card'],
        )
        self._status_lbl.pack(side='left')

        Divider(inner).pack(fill='x', pady=(0, SPACE['md']))

        # Login button
        self._btn = PremiumButton(
            inner,
            style='primary',
            text='Connect to Server',
            command=self._do_login,
        )
        self._btn.pack(fill='x', ipady=4)

        # Footer
        tk.Label(
            center,
            text=APP_FOOTER,
            font=FONT['caption'],
            bg=C['bg_app'],
            fg=C['text_tertiary'],
        ).pack(pady=(16, 0))

    # ── Logic ──────────────────────────────────────────────────────────────────

    def try_auto_login(self):
        """Called by app.py after the frame is shown — tries saved token."""
        token = self._settings.load_session_token()
        if not token:
            return

        self._set_status('Restoring session…', 'paused')
        self.after(100, lambda: self._validate_saved_token(token))

    def _validate_saved_token(self, token: str):
        try:
            self._api.server_url = self._settings.server_url
            user = self._api.validate_token(token)
            if user:
                self._set_status('Session restored', 'online')
                self.after(300, lambda: self._on_success(user))
            else:
                self._set_status('Session expired — please log in', 'offline')
                self._settings.clear_session_token()
        except Exception as e:
            self._set_status(f'Could not reach server: {e}', 'offline')

    def _do_login(self):
        if self._connecting:
            return

        server = self._server_input.value
        email  = self._email_input.value
        pw     = self._pw_input.value

        if not server:
            self._set_status('Server URL is required', 'offline')
            return
        if not email or not pw:
            self._set_status('Email and password are required', 'offline')
            return

        self._connecting = True
        self._btn.config(state='disabled', text='Connecting…')
        self._set_status('Connecting…', 'paused')

        # Run login in background thread to avoid blocking UI
        import threading
        threading.Thread(target=self._login_thread, args=(server, email, pw), daemon=True).start()

    def _login_thread(self, server: str, email: str, pw: str):
        from src.api.client import ApiError
        try:
            self._api.server_url = server
            result = self._api.login(email, pw)

            # Save settings
            self._settings.server_url  = server
            self._settings.agent_email = email
            self._settings.save()

            self.after(0, lambda: self._on_success(result.get('user', {})))
        except ApiError as e:
            self.after(0, lambda: self._login_failed(str(e)))
        except Exception as e:
            self.after(0, lambda: self._login_failed(f'Network error: {e}'))

    def _login_failed(self, msg: str):
        self._connecting = False
        self._btn.config(state='normal', text='Connect to Server')
        self._set_status(msg, 'offline')

    def _set_status(self, text: str, dot: str = 'offline'):
        self._dot.set(dot)
        self._status_lbl.config(text=text)
