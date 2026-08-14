"""
App Controller
==============
Root Tk window. Manages:
 - Sidebar navigation with 4 pages
 - Login/Dashboard frame switching
 - Event queue processing (from background poll thread)
 - App controller interface for pages
 - System tray lifecycle
"""
import sys
import queue
import threading
import platform
import tkinter as tk
from datetime import datetime
from pathlib import Path

from src.ui.theme import C, FONT, SPACE, DIM
from src.ui.widgets.components import StatusDot, Divider, PremiumButton
from src.ui.login_frame import LoginFrame
from src.api.client import InksApiClient
from src.services.poll_service import PollService
from src.services.command_service import CommandService
from src.services.print_queue_worker import PrintQueueWorker
from src.services.notifier import play_new_job_sound, show_toast
from src.utils.logger import log_click, log_info, log_error, get_log_file_path
from src.config.constants import (
    APP_NAME, APP_FOOTER, WINDOW_WIDTH, WINDOW_HEIGHT,
    WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT, SIDEBAR_WIDTH,
)


NAV_ITEMS = [
    ('queue',    '🖨', 'Print Queue'),
    ('dashboard','📊', 'Dashboard'),
    ('settings', '⚙', 'Settings'),
    ('log',      '📝', 'Activity Log'),
]


class PrinterAgentApp:
    """
    Root application class. Owns the Tk window and all pages.
    """

    def __init__(self, settings):
        self.settings = settings
        self.api      = InksApiClient(settings.server_url, settings)

        self._event_q     = queue.Queue()
        self._poll_svc: PollService | None    = None
        self._cmd_svc:  CommandService | None = None

        self._orders: list[dict] = []
        self._printed_today = 0
        self._failed_today  = 0
        self._last_poll_ts  = '—'
        self._known_order_ids: set = set()

        # Pages (created after login)
        self._queue_page    = None
        self._dashboard_page= None
        self._settings_page = None
        self._log_page      = None

        self._current_page  = None
        self._nav_buttons   = {}

        self._root: tk.Tk | None = None
        self._tray = None

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self):
        self._root = tk.Tk()
        self._root.title(APP_NAME)
        self._root.geometry(f'{WINDOW_WIDTH}x{WINDOW_HEIGHT}')
        self._root.minsize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)
        self._root.configure(bg=C['bg_app'])

        # Set window icon if available
        assets_dir = Path(sys._MEIPASS) / 'assets' if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS') else Path(__file__).parent.parent.parent / 'assets'
        icon_path = assets_dir / 'icon.png'
        if icon_path.exists():
            try:
                from PIL import Image, ImageTk
                img = ImageTk.PhotoImage(Image.open(icon_path).resize((32, 32)))
                self._root.iconphoto(True, img)
                self._root._icon_ref = img   # prevent GC
            except Exception:
                pass

        self._root.protocol('WM_DELETE_WINDOW', self._on_close)
        self._show_login()
        self._root.mainloop()

    # ── Login flow ────────────────────────────────────────────────────────────

    def _show_login(self):
        if hasattr(self, '_main_frame') and self._main_frame:
            self._main_frame.destroy()

        self._login_frame = LoginFrame(
            self._root,
            on_login_success=self._on_login_success,
            settings=self.settings,
            api_client=self.api,
        )
        self._login_frame.pack(fill='both', expand=True)
        self._login_frame.try_auto_login()

    def _on_login_success(self, user: dict):
        self.log(f'Connected as {user.get("name", "—")} ({user.get("email", "—")})')
        self._login_frame.destroy()
        self._build_main_layout(user)
        self._start_services()

    # ── Main Layout ───────────────────────────────────────────────────────────

    def _build_main_layout(self, user: dict):
        self._main_frame = tk.Frame(self._root, bg=C['bg_app'])
        self._main_frame.pack(fill='both', expand=True)
        self._user = user

        # Restore persistent sheets printed today counter for current date
        today_str = datetime.now().strftime('%Y-%m-%d')
        if getattr(self.settings, 'printed_today_date', '') == today_str:
            self._printed_today = getattr(self.settings, 'printed_today', 0)
        else:
            self.settings.printed_today_date = today_str
            self.settings.printed_today = 0
            self._printed_today = 0
            self.settings.save()

        # ── Sidebar ──────────────────────────────────────────────────────────
        self._sidebar = tk.Frame(
            self._main_frame,
            bg=C['bg_sidebar'],
            width=SIDEBAR_WIDTH,
            highlightbackground=C['border'],
            highlightthickness=1,
        )
        self._sidebar.pack(side='left', fill='y')
        self._sidebar.pack_propagate(False)

        self._build_sidebar(user)

        # ── Content area ──────────────────────────────────────────────────────
        self._content_area = tk.Frame(self._main_frame, bg=C['bg_content'])
        self._content_area.pack(side='left', fill='both', expand=True)

        # Create all pages
        from src.ui.pages.queue_page        import QueuePage
        from src.ui.pages.dashboard_page    import DashboardPage
        from src.ui.pages.settings_page     import SettingsPage
        from src.ui.pages.activity_log_page import ActivityLogPage

        self._queue_page     = QueuePage(self._content_area, self)
        self._dashboard_page = DashboardPage(self._content_area, self)
        self._settings_page  = SettingsPage(self._content_area, self)
        self._log_page       = ActivityLogPage(self._content_area, self)

        # Show Queue by default
        self._navigate('queue')

    def _build_sidebar(self, user: dict):
        sb = self._sidebar

        # App logo / name
        logo_frame = tk.Frame(sb, bg=C['bg_sidebar'], pady=SPACE['lg'])
        logo_frame.pack(fill='x', padx=SPACE['md'])

        tk.Label(logo_frame, text='🖨', font=('Segoe UI Emoji', 20),
                 bg=C['bg_sidebar'], fg=C['accent']).pack(anchor='w')
        tk.Label(logo_frame, text=APP_NAME, font=FONT['h4'],
                 bg=C['bg_sidebar'], fg=C['text_primary']).pack(anchor='w')

        Divider(sb).pack(fill='x', padx=SPACE['sm'], pady=SPACE['sm'])

        # Status indicator
        status_row = tk.Frame(sb, bg=C['bg_sidebar'])
        status_row.pack(fill='x', padx=SPACE['md'], pady=(0, SPACE['sm']))

        self._sidebar_dot = StatusDot(status_row, status='online', bg=C['bg_sidebar'])
        self._sidebar_dot.pack(side='left', padx=(0, 6))

        self._sidebar_status = tk.Label(
            status_row, text='Connected',
            font=FONT['body_sm'], fg=C['text_secondary'], bg=C['bg_sidebar'],
        )
        self._sidebar_status.pack(side='left')

        Divider(sb).pack(fill='x', padx=SPACE['sm'], pady=SPACE['sm'])

        # Nav items
        nav_frame = tk.Frame(sb, bg=C['bg_sidebar'])
        nav_frame.pack(fill='x', padx=SPACE['sm'])

        for key, icon, label in NAV_ITEMS:
            btn_frame = tk.Frame(nav_frame, bg=C['bg_sidebar'])
            btn_frame.pack(fill='x', pady=1)

            btn = tk.Button(
                btn_frame,
                text=f'  {icon}  {label}',
                font=FONT['nav'],
                bg=C['bg_sidebar'],
                fg=C['sidebar_item_text'],
                activebackground=C['sidebar_item_active_bg'],
                activeforeground=C['sidebar_item_active_fg'],
                relief='flat',
                anchor='w',
                padx=SPACE['sm'],
                pady=SPACE['sm'],
                cursor='hand2',
                highlightthickness=0,
                bd=0,
                command=lambda k=key: self._navigate(k),
            )
            btn.pack(fill='x')
            btn.bind('<Enter>', lambda *e, b=btn: b.config(bg=C['bg_hover']))
            btn.bind('<Leave>', lambda *e, b=btn, k=key: b.config(
                bg=C['sidebar_item_active_bg'] if self._current_page == k else C['bg_sidebar']
            ))
            self._nav_buttons[key] = btn

        # Bottom section — user info + disconnect
        bottom = tk.Frame(sb, bg=C['bg_sidebar'])
        bottom.pack(side='bottom', fill='x', padx=SPACE['sm'], pady=SPACE['sm'])

        Divider(bottom).pack(fill='x', pady=(0, SPACE['sm']))

        # Queue badge
        self._queue_badge_var = tk.StringVar(value='0 jobs')
        tk.Label(bottom, textvariable=self._queue_badge_var,
                 font=FONT['caption'], fg=C['text_tertiary'], bg=C['bg_sidebar']
                 ).pack(anchor='w', padx=SPACE['xs'])

        # User name
        tk.Label(bottom,
                 text=f'👤 {user.get("name", "—")}',
                 font=FONT['body_sm'], fg=C['text_secondary'], bg=C['bg_sidebar']
                 ).pack(anchor='w', padx=SPACE['xs'], pady=(2, 0))

        # Disconnect
        disconnect_btn = tk.Button(
            bottom, text='⏻  Disconnect',
            font=FONT['body_sm'], bg=C['bg_sidebar'], fg=C['error'],
            activebackground=C['error_light'], activeforeground=C['error'],
            relief='flat', cursor='hand2', highlightthickness=0, bd=0,
            padx=SPACE['xs'], pady=SPACE['xs'],
            command=self._disconnect,
            anchor='w',
        )
        disconnect_btn.pack(fill='x')

        # Version / footer
        tk.Label(bottom, text=APP_FOOTER,
                 font=FONT['caption'], fg=C['text_tertiary'], bg=C['bg_sidebar']
                 ).pack(anchor='w', padx=SPACE['xs'], pady=(SPACE['sm'], 0))

    # ── Navigation ────────────────────────────────────────────────────────────

    def _navigate(self, key: str):
        log_click('NAV_TAB', key)
        page_map = {
            'queue':     self._queue_page,
            'dashboard': self._dashboard_page,
            'settings':  self._settings_page,
            'log':       self._log_page,
        }

        # Hide all pages to prevent widget overlap or mouse event bleeding
        for p in page_map.values():
            if p:
                p.pack_forget()

        # Update button styles
        for k, btn in self._nav_buttons.items():
            if k == key:
                btn.config(bg=C['sidebar_item_active_bg'], fg=C['sidebar_item_active_fg'])
            else:
                btn.config(bg=C['bg_sidebar'], fg=C['sidebar_item_text'])

        # Show new page
        self._current_page = key
        page = page_map.get(key)
        if page:
            page.pack(fill='both', expand=True)
            if key == 'log' and hasattr(page, '_refresh'):
                page._refresh(scroll_bottom=True)
            elif key == 'queue' and hasattr(page, '_refresh_cards'):
                page._refresh_cards(force=True)

    def _stop_services(self):
        if hasattr(self, 'print_worker') and self.print_worker:
            try:
                self.print_worker.stop()
            except Exception:
                pass
        if hasattr(self, '_poll_svc') and self._poll_svc:
            try:
                self._poll_svc.stop()
            except Exception:
                pass
        self._is_active = False

    def _start_services(self):
        self._stop_services()
        self._is_active = True
        self.print_worker = PrintQueueWorker(self.api, self.settings, self._event_q)
        self.print_worker.start()
        self._poll_svc = PollService(self.api, self._event_q, self.settings.poll_interval)
        self._cmd_svc  = CommandService(self.api, self._event_q)
        self._poll_svc.start()
        self._process_events()

    def _process_events(self):
        """Drain the event queue and update UI — runs on main thread via after()."""
        if not getattr(self, '_is_active', False) or not self._root:
            return

        try:
            while True:
                event = self._event_q.get_nowait()
                try:
                    self._handle_event(event)
                except Exception as ev_err:
                    log_error(f"Error handling event {event.get('type')}: {ev_err}", exc=ev_err)
        except queue.Empty:
            pass
        finally:
            if getattr(self, '_is_active', False):
                try:
                    if self._root and self._root.winfo_exists():
                        self._root.after(200, self._process_events)
                except Exception:
                    pass

    def _handle_event(self, event: dict):
        etype = event.get('type')

        if etype == 'ORDERS':
            orders = event.get('orders', [])
            new_ids = {o['id'] for o in orders}
            brand_new = new_ids - self._known_order_ids

            if brand_new and self._known_order_ids:
                # Only alert if we had a previous baseline (not first poll)
                if self.settings.sound_alerts:
                    play_new_job_sound()
                show_toast('New Print Job', f'{len(brand_new)} new job(s) arrived in queue')
                self.log(f'📥 {len(brand_new)} new job(s) arrived')
                self.api.log_activity('POLL', details={'new_jobs': len(brand_new)})

            self._known_order_ids = new_ids
            self._orders = orders
            self._last_poll_ts = datetime.now().strftime('%H:%M:%S')

            # Update pages
            if self._queue_page:
                self._queue_page.update_orders(orders)
            if self._dashboard_page:
                self._dashboard_page.update_orders(orders)
                self._dashboard_page.update_stats(
                    self._printed_today, len(orders), self._failed_today
                )
                self._dashboard_page.update_info(
                    server=self.settings.server_url,
                    user=self._user.get('name', '—'),
                    printer=self.settings.printer_name or 'OS Default',
                    mode='Auto-Print' if self.settings.auto_print else 'Manual',
                    poll=f'{self.settings.poll_interval}s',
                    last_poll=self._last_poll_ts,
                )

            # Queue badge in sidebar
            if hasattr(self, '_queue_badge_var'):
                self._queue_badge_var.set(f'{len(orders)} job{"s" if len(orders) != 1 else ""} in queue')

            # Auto-print logic — ensure each order is queued EXACTLY ONCE
            if self.settings.auto_print and self._queue_page:
                for order in orders:
                    oid = order['id']
                    if oid not in self._queue_page._printing_ids:
                        self._queue_page._printing_ids.add(oid)
                        delay_ms = max(0, getattr(self.settings, 'auto_print_delay', 0) * 1000)
                        if delay_ms > 0:
                            self._root.after(
                                delay_ms,
                                lambda o=order: self._queue_page._print_one(o)
                            )
                        else:
                            self._queue_page._print_one(order)

        elif etype == 'POLL_START':
            pass   # Could show a subtle spinner

        elif etype == 'ERROR':
            self.log(f'Connection error: {event.get("message")}', 'ERROR')
            self._set_sidebar_status('Connection error', 'offline')

        elif etype == 'STATUS':
            val = event.get('value')
            if val == 'paused':
                self._set_sidebar_status('Paused', 'paused')
                if self._dashboard_page:
                    self._dashboard_page.set_status('Agent paused', 'paused')
            elif val == 'running':
                self._set_sidebar_status('Connected', 'online')
                if self._dashboard_page:
                    self._dashboard_page.set_status('Connected and polling', 'online')

        elif etype == 'PRINT_PROGRESS':
            if self._queue_page:
                self._queue_page.update_progress(event)

        elif etype == 'LOG':
            if self._log_page:
                self._log_page.append(event.get('msg', ''), event.get('severity', 'INFO'))

        elif etype == 'INC_PRINTED':
            self.increment_printed(event.get('sheets', 1))

        elif etype == 'INC_FAILED':
            self.increment_failed()

        elif etype == 'PRINT_JOB_DONE':
            order_id = event.get('orderId')
            if order_id:
                if self._queue_page:
                    self._queue_page._printing_ids.discard(order_id)
                self._orders = [o for o in self._orders if o['id'] != order_id]
                if self._queue_page:
                    self._queue_page.update_orders(self._orders)
                if self._poll_svc:
                    self._poll_svc.force_poll_now()

        elif etype == 'COMMANDS':
            self._cmd_svc.process(event.get('commands', []))

        elif etype == 'REMOTE_CMD':
            self._execute_remote_command(event)

    def _execute_remote_command(self, event: dict):
        cmd     = event.get('cmd', '')
        payload = event.get('payload', {})

        self.log(f'⚡ Remote command: {cmd}')

        if cmd == 'PAUSE':
            if self._poll_svc:
                self._poll_svc.pause()

        elif cmd == 'RESUME':
            if self._poll_svc:
                self._poll_svc.resume()

        elif cmd == 'FORCE_POLL':
            if self._poll_svc:
                self._poll_svc.force_poll_now()

        elif cmd == 'CHANGE_PRINTER':
            new_printer = payload.get('printer', '')
            if new_printer:
                self.settings.printer_name = new_printer
                self.settings.save()
                self.log(f'Printer changed to: {new_printer}')

        elif cmd == 'SET_AUTO_MODE':
            enabled = payload.get('enabled', False)
            self.settings.auto_print = enabled
            self.settings.save()
            self.log(f'Auto-print {"enabled" if enabled else "disabled"}')

        elif cmd == 'CHANGE_POLL_INTERVAL':
            interval = int(payload.get('interval', 10))
            self.settings.poll_interval = interval
            self.settings.save()
            if self._poll_svc:
                self._poll_svc.set_interval(interval)
            self.log(f'Poll interval changed to {interval}s')

        elif cmd == 'DISCONNECT':
            self.log('Remote disconnect command received')
            self._root.after(1000, self._disconnect)

        elif cmd == 'PRINT_ORDER':
            order_id = payload.get('orderId')
            if order_id and self._queue_page:
                target = next((o for o in self._orders if o['id'] == order_id), None)
                if not target:
                    target = {
                        'id': order_id,
                        'orderNumber': payload.get('orderNumber', f'PRT-{order_id}'),
                        'copies': payload.get('copies', 1),
                    }
                self.log(f'⚡ Remote print command received for order #{target["orderNumber"]}')
                self._queue_page._print_one(target)

    # ── Controller interface (used by pages) ───────────────────────────────────

    def log(self, msg: str, severity: str = 'INFO'):
        """Thread-safe activity logger (UI + Disk File)."""
        if severity.upper() == 'ERROR':
            log_error(f"UI_LOG: {msg}")
        else:
            log_info(f"UI_LOG: {msg}")

        if threading.current_thread() is threading.main_thread():
            if self._log_page:
                self._log_page.append(msg, severity)
        else:
            self._event_q.put({'type': 'LOG', 'msg': msg, 'severity': severity})

    def increment_printed(self, sheets: int = 1):
        """Thread-safe increment of printed sheets counter with local cache persistence."""
        if threading.current_thread() is threading.main_thread():
            today_str = datetime.now().strftime('%Y-%m-%d')
            if getattr(self.settings, 'printed_today_date', '') != today_str:
                self.settings.printed_today_date = today_str
                self.settings.printed_today = 0

            self.settings.printed_today += sheets
            self._printed_today = self.settings.printed_today
            self.settings.save()

            if self._dashboard_page:
                self._dashboard_page.update_stats(
                    self._printed_today, len(self._orders), self._failed_today
                )
        else:
            self._event_q.put({'type': 'INC_PRINTED', 'sheets': sheets})

    def refresh_status(self):
        """Force immediate poll and status telemetry sync from server."""
        self.log('🔄 Syncing queue & status telemetry…')
        if self._poll_svc:
            self._poll_svc.force_poll_now()

    def increment_failed(self):
        """Thread-safe increment of failed counter."""
        if threading.current_thread() is threading.main_thread():
            self._failed_today += 1
            if self._dashboard_page:
                self._dashboard_page.update_stats(
                    self._printed_today, len(self._orders), self._failed_today
                )
        else:
            self._event_q.put({'type': 'INC_FAILED'})

    def apply_settings(self):
        """Called after settings are saved — applies live changes."""
        if self._poll_svc:
            self._poll_svc.set_interval(self.settings.poll_interval)
        self.log('Settings applied')

    # ── Sidebar status ─────────────────────────────────────────────────────────

    def _set_sidebar_status(self, text: str, dot: str = 'online'):
        if hasattr(self, '_sidebar_dot'):
            self._sidebar_dot.set(dot)
        if hasattr(self, '_sidebar_status'):
            self._sidebar_status.config(text=text)

    # ── Disconnect ────────────────────────────────────────────────────────────

    def _disconnect(self):
        self._is_active = False
        self.log('Disconnecting…')
        if hasattr(self, 'print_worker') and self.print_worker:
            self.print_worker.stop()
        if self._poll_svc:
            self._poll_svc.stop()
        try:
            self.api.disconnect()
        except Exception:
            pass
        self.settings.clear_session_token()

        # Go back to login
        self._main_frame.destroy()
        self._show_login()

    # ── Window close ──────────────────────────────────────────────────────────

    def _on_close(self):
        # Pop up confirmation dialog asking user to Exit, Minimize, or Cancel
        dialog = tk.Toplevel(self._root)
        dialog.title("Exit Inks Printer Agent")
        dialog.geometry("420x210")
        dialog.resizable(False, False)
        dialog.configure(bg=C['bg_card'])
        dialog.transient(self._root)
        dialog.grab_set()

        # Center dialog relative to main window
        try:
            x = self._root.winfo_x() + (self._root.winfo_width() // 2) - 210
            y = self._root.winfo_y() + (self._root.winfo_height() // 2) - 105
            dialog.geometry(f"+{x}+{y}")
        except Exception:
            pass

        inner = tk.Frame(dialog, bg=C['bg_card'])
        inner.pack(fill='both', expand=True, padx=SPACE['lg'], pady=SPACE['lg'])

        tk.Label(
            inner, text="🖨  Close Inks Printer Agent?",
            font=FONT['h2'], bg=C['bg_card'], fg=C['text_primary'],
        ).pack(anchor='w', pady=(0, 4))

        tk.Label(
            inner,
            text="Would you like to keep the agent printing in the background via the system tray, or exit the application completely?",
            font=FONT['body'], bg=C['bg_card'], fg=C['text_secondary'],
            wraplength=380, justify='left',
        ).pack(anchor='w', pady=(0, SPACE['lg']))

        btn_row = tk.Frame(inner, bg=C['bg_card'])
        btn_row.pack(fill='x', side='bottom')

        def _do_exit():
            dialog.destroy()
            self._quit()

        def _do_minimize():
            dialog.destroy()
            self._minimize_to_tray()

        def _do_cancel():
            dialog.destroy()

        dialog.protocol("WM_DELETE_WINDOW", _do_cancel)

        PremiumButton(btn_row, style='primary', text='📌 Minimize to Tray', command=_do_minimize).pack(side='left', padx=(0, SPACE['xs']))
        PremiumButton(btn_row, style='danger', text='⏻ Exit App', command=_do_exit).pack(side='left', padx=(0, SPACE['xs']))
        PremiumButton(btn_row, style='ghost', text='Cancel', command=_do_cancel).pack(side='right')

    def _minimize_to_tray(self):
        self._root.withdraw()
        try:
            from src.ui.tray import create_tray_icon
            self._tray = create_tray_icon(
                on_show=self._restore_from_tray,
                on_quit=self._quit,
            )
        except Exception:
            self._root.deiconify()

    def _restore_from_tray(self):
        if self._tray:
            self._tray.stop()
        self._root.deiconify()
        self._root.lift()

    def _quit(self):
        self._is_active = False
        if hasattr(self, 'print_worker') and self.print_worker:
            self.print_worker.stop()
        if self._poll_svc:
            self._poll_svc.stop()
        try:
            self.api.disconnect()
        except Exception:
            pass
        if self._tray:
            try:
                self._tray.stop()
            except Exception:
                pass
        try:
            self._root.destroy()
        except Exception:
            pass
