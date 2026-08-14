"""
Dashboard Page
==============
Live stats overview — jobs printed today, queue depth, uptime, connection info.
"""
import tkinter as tk
from datetime import datetime, timedelta

from src.ui.theme import C, FONT, SPACE
from src.ui.widgets.components import Card, Badge, StatusDot, Divider, SectionHeader


class DashboardPage(tk.Frame):

    def __init__(self, parent, app_controller, **kwargs):
        super().__init__(parent, bg=C['bg_content'], **kwargs)
        self._ctrl  = app_controller
        self._start = datetime.now()

        self._stat_vars: dict[str, tk.StringVar] = {}
        self._build()

        # Refresh uptime every second
        self._tick()

    # ── Build ──────────────────────────────────────────────────────────────────

    def _build(self):
        pad = SPACE['xl']

        # Page title
        hdr = tk.Frame(self, bg=C['bg_content'])
        hdr.pack(fill='x', padx=pad, pady=(pad, SPACE['sm']))

        tk.Label(hdr, text='Dashboard', font=FONT['h2'],
                 bg=C['bg_content'], fg=C['text_primary']).pack(anchor='w')
        tk.Label(hdr, text='Live session overview',
                 font=FONT['body'], bg=C['bg_content'],
                 fg=C['text_secondary']).pack(anchor='w')

        Divider(self).pack(fill='x', padx=pad, pady=(0, pad))

        # ── Stat cards row ────────────────────────────────────────────────────
        row = tk.Frame(self, bg=C['bg_content'])
        row.pack(fill='x', padx=pad)

        self._stat_card(row, 'printed_today', '0',   'Printed Today',  C['success'], '✓').pack(side='left', padx=(0, SPACE['md']), fill='x', expand=True)
        self._stat_card(row, 'queue_size',    '0',   'In Queue',       C['accent'],  '⏳').pack(side='left', padx=(0, SPACE['md']), fill='x', expand=True)
        self._stat_card(row, 'failed',        '0',   'Failed',         C['error'],   '✗').pack(side='left', padx=(0, SPACE['md']), fill='x', expand=True)
        self._stat_card(row, 'uptime',        '0s',  'Uptime',         C['info'],    '⏱').pack(side='left', fill='x', expand=True)

        # ── Connection info card ──────────────────────────────────────────────
        info_card = Card(self)
        info_card.pack(fill='x', padx=pad, pady=(pad, 0))

        info_inner = tk.Frame(info_card, bg=C['bg_card'])
        info_inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])

        SectionHeader(info_inner, text='Connection Info', bg=C['bg_card']).pack(fill='x', pady=(0, SPACE['md']))

        self._info_rows = {}
        for key, label in [
            ('server',    'Server URL'),
            ('user',      'Logged In As'),
            ('printer',   'Selected Printer'),
            ('mode',      'Print Mode'),
            ('poll',      'Poll Interval'),
            ('last_poll', 'Last Poll'),
        ]:
            row_f = tk.Frame(info_inner, bg=C['bg_card'])
            row_f.pack(fill='x', pady=2)

            tk.Label(row_f, text=label, font=FONT['label'],
                     fg=C['text_tertiary'], bg=C['bg_card'], width=16, anchor='w').pack(side='left')

            var = tk.StringVar(value='—')
            lbl = tk.Label(row_f, textvariable=var, font=FONT['body'],
                           fg=C['text_primary'], bg=C['bg_card'], anchor='w')
            lbl.pack(side='left', fill='x', expand=True)

            self._info_rows[key] = var

        # ── Quick Print & Pending Jobs Card ──────────────────────────────────
        self._jobs_card = Card(self)
        self._jobs_card.pack(fill='x', padx=pad, pady=(pad, 0))

        jobs_inner = tk.Frame(self._jobs_card, bg=C['bg_card'])
        jobs_inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])

        SectionHeader(jobs_inner, text='⚡ Quick Print & Pending Jobs', bg=C['bg_card']).pack(fill='x', pady=(0, SPACE['sm']))

        self._jobs_container = tk.Frame(jobs_inner, bg=C['bg_card'])
        self._jobs_container.pack(fill='x')

        self._empty_jobs_lbl = tk.Label(
            self._jobs_container, text='✓ No pending jobs in queue',
            font=FONT['body'], fg=C['text_tertiary'], bg=C['bg_card'], pady=10
        )
        self._empty_jobs_lbl.pack(anchor='w')

        # ── Status indicator ──────────────────────────────────────────────────
        status_row = tk.Frame(self, bg=C['bg_content'])
        status_row.pack(fill='x', padx=pad, pady=(SPACE['md'], 0))

        self._dot = StatusDot(status_row, status='online', bg=C['bg_content'])
        self._dot.pack(side='left', padx=(0, 6))

        self._status_lbl = tk.Label(
            status_row, text='Connected and polling',
            font=FONT['body'], fg=C['text_secondary'], bg=C['bg_content'],
        )
        self._status_lbl.pack(side='left')

    def _stat_card(self, parent, key: str, initial: str, label: str, color: str, icon: str) -> Card:
        card = Card(parent)
        inner = tk.Frame(card, bg=C['bg_card'])
        inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])

        tk.Label(inner, text=icon, font=('Segoe UI Emoji', 18),
                 bg=C['bg_card'], fg=color).pack(anchor='w')

        var = tk.StringVar(value=initial)
        self._stat_vars[key] = var

        tk.Label(inner, textvariable=var, font=('Segoe UI Semibold', 28),
                 bg=C['bg_card'], fg=color).pack(anchor='w')

        tk.Label(inner, text=label, font=FONT['body_sm'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(anchor='w')

        return card

    # ── Update Methods (called by app controller) ──────────────────────────────

    def update_orders(self, orders: list[dict]):
        """Render recent pending jobs with page counts and instant print buttons."""
        if not hasattr(self, '_jobs_container'):
            return

        for w in self._jobs_container.winfo_children():
            w.destroy()

        if not orders:
            tk.Label(
                self._jobs_container, text='🎉 All caught up! No pending jobs.',
                font=FONT['body'], fg=C['text_tertiary'], bg=C['bg_card'], pady=10
            ).pack(anchor='w')
            return

        # Render top 5 pending orders for instant printing
        for order in orders[:5]:
            row = tk.Frame(self._jobs_container, bg=C['bg_card'])
            row.pack(fill='x', pady=4)

            # Order details & page count
            pages = order.get('totalPages', 1)
            copies = order.get('copies', 1)
            total_sheets = pages * copies
            doc_name = order.get('document', {}).get('originalName', 'Document')

            info_f = tk.Frame(row, bg=C['bg_card'])
            info_f.pack(side='left', fill='x', expand=True)

            tk.Label(
                info_f, text=f'#{order.get("orderNumber")} · {doc_name}',
                font=FONT['bold'], bg=C['bg_card'], fg=C['text_primary']
            ).pack(anchor='w')

            spec_txt = f'📄 {pages} page{"s" if pages != 1 else ""} × {copies} cop{"y" if copies == 1 else "ies"} ({total_sheets} total sheets) · {order.get("paperSize", "A4")} {order.get("colorMode", "BW")}'
            tk.Label(
                info_f, text=spec_txt,
                font=FONT['body_sm'], bg=C['bg_card'], fg=C['text_secondary']
            ).pack(anchor='w')

            # Instant Print Button
            from src.ui.widgets.components import PremiumButton
            PremiumButton(
                row, style='primary', text='🖨  Instant Print',
                command=lambda o=order: self._print_instantly(o)
            ).pack(side='right', padx=(SPACE['sm'], 0))

    def _print_instantly(self, order: dict):
        """Instantly enqueue order and start printing."""
        if hasattr(self._ctrl, 'print_worker'):
            self._ctrl.log(f'⚡ Dashboard instant print triggered for #{order.get("orderNumber")}')
            if hasattr(self._ctrl, '_queue_page') and self._ctrl._queue_page:
                self._ctrl._queue_page._printing_ids.add(order['id'])
            self._ctrl.print_worker.enqueue(order)

    def update_stats(self, printed: int, queue: int, failed: int):
        self._stat_vars['printed_today'].set(str(printed))
        self._stat_vars['queue_size'].set(str(queue))
        self._stat_vars['failed'].set(str(failed))

    def update_info(self, **kwargs):
        for key, val in kwargs.items():
            if key in self._info_rows:
                self._info_rows[key].set(str(val))

    def set_status(self, text: str, dot: str = 'online'):
        self._dot.set(dot)
        self._status_lbl.config(text=text)

    def _tick(self):
        try:
            if not self.winfo_exists():
                return
            elapsed = datetime.now() - self._start
            s = int(elapsed.total_seconds())
            h, r = divmod(s, 3600)
            m, s = divmod(r, 60)
            if h:
                uptime = f'{h}h {m}m {s}s'
            elif m:
                uptime = f'{m}m {s}s'
            else:
                uptime = f'{s}s'

            self._stat_vars['uptime'].set(uptime)
            self.after(1000, self._tick)
        except Exception:
            pass
