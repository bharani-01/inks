"""
Activity Log Page
=================
Full paginated timestamped log with severity filtering, search, and page controls.
"""
import tkinter as tk
from datetime import datetime

from src.ui.theme import C, FONT, SPACE
from src.ui.widgets.components import (
    Card, Badge, PremiumButton, ScrollableFrame, Divider
)

# Severity color map
_SEV = {
    'INFO':  (C['log_info_bg'],  C['log_info_fg'],  '·'),
    'WARN':  (C['log_warn_bg'],  C['log_warn_fg'],  '⚠'),
    'ERROR': (C['log_error_bg'], C['log_error_fg'], '✗'),
}


class ActivityLogPage(tk.Frame):

    def __init__(self, parent, app_controller, **kwargs):
        super().__init__(parent, bg=C['bg_content'], **kwargs)
        self._ctrl  = app_controller
        self._logs: list[dict] = []      # {'time', 'msg', 'severity'}
        self._filter_sev = tk.StringVar(value='ALL')
        self._search_var = tk.StringVar()
        self._search_var.trace_add('write', lambda *_: self._on_search_change())

        # Pagination state
        self._current_page = 1
        self._per_page     = 30

        self._build()

    # ── Build ──────────────────────────────────────────────────────────────────

    def _build(self):
        pad = SPACE['xl']

        # Page header
        hdr = tk.Frame(self, bg=C['bg_content'])
        hdr.pack(fill='x', padx=pad, pady=(pad, SPACE['sm']))

        title_row = tk.Frame(hdr, bg=C['bg_content'])
        title_row.pack(fill='x')

        tk.Label(title_row, text='Activity Log', font=FONT['h2'],
                 bg=C['bg_content'], fg=C['text_primary']).pack(side='left', anchor='w')

        PremiumButton(title_row, style='ghost', text='🗑  Clear',
                      command=self._clear).pack(side='right')

        PremiumButton(title_row, style='secondary', text='⬇ Scroll to Bottom',
                      command=self._scroll_bottom).pack(side='right', padx=(0, SPACE['sm']))

        tk.Label(hdr, text='Real-time log of all agent activity',
                 font=FONT['body'], bg=C['bg_content'],
                 fg=C['text_secondary']).pack(anchor='w', pady=(2, 0))

        # Filter row
        filter_row = tk.Frame(self, bg=C['bg_content'])
        filter_row.pack(fill='x', padx=pad, pady=(SPACE['sm'], 0))

        tk.Label(filter_row, text='Filter:', font=FONT['label'],
                 bg=C['bg_content'], fg=C['text_secondary']).pack(side='left', padx=(0, SPACE['sm']))

        for sev in ('ALL', 'INFO', 'WARN', 'ERROR'):
            btn = tk.Radiobutton(
                filter_row, text=sev, variable=self._filter_sev, value=sev,
                font=FONT['label'], bg=C['bg_content'], fg=C['text_secondary'],
                activebackground=C['bg_content'], selectcolor=C['bg_content'],
                highlightthickness=0, cursor='hand2',
                command=self._on_filter_change,
            )
            btn.pack(side='left', padx=SPACE['xs'])

        # Search
        tk.Label(filter_row, text='Search:', font=FONT['label'],
                 bg=C['bg_content'], fg=C['text_secondary']).pack(side='left', padx=(SPACE['lg'], SPACE['sm']))

        tk.Entry(
            filter_row, textvariable=self._search_var,
            font=FONT['body'], width=24, relief='flat',
            bg=C['bg_input'], fg=C['text_primary'],
            highlightbackground=C['border'], highlightthickness=1,
        ).pack(side='left', ipady=4, ipadx=6)

        Divider(self).pack(fill='x', padx=pad, pady=(SPACE['sm'], 0))

        # Log area
        self._scroll = ScrollableFrame(self, bg=C['bg_content'])
        self._scroll.pack(fill='both', expand=True, padx=pad, pady=(0, SPACE['xs']))

        # Pagination Bar Footer
        self._pagi_bar = tk.Frame(self, bg=C['bg_content'])
        self._pagi_bar.pack(fill='x', padx=pad, pady=(0, SPACE['md']))

        self._count_lbl = tk.Label(
            self._pagi_bar, text='Page 1 of 1 (0 entries)',
            font=FONT['body_sm'], bg=C['bg_content'], fg=C['text_secondary'],
        )
        self._count_lbl.pack(side='left')

        p_right = tk.Frame(self._pagi_bar, bg=C['bg_content'])
        p_right.pack(side='right')

        self._prev_btn = PremiumButton(
            p_right, style='secondary', text='‹ Previous',
            command=self._prev_page,
        )
        self._prev_btn.pack(side='left', padx=(0, SPACE['xs']))

        self._next_btn = PremiumButton(
            p_right, style='secondary', text='Next ›',
            command=self._next_page,
        )
        self._next_btn.pack(side='left')

    # ── Pagination Handlers ───────────────────────────────────────────────────

    def _on_filter_change(self):
        self._current_page = 1
        self._refresh()

    def _on_search_change(self):
        self._current_page = 1
        self._refresh()

    def _prev_page(self):
        if self._current_page > 1:
            self._current_page -= 1
            self._refresh()

    def _next_page(self):
        visible = self._get_visible_logs()
        total_pages = max(1, (len(visible) + self._per_page - 1) // self._per_page)
        if self._current_page < total_pages:
            self._current_page += 1
            self._refresh()

    def _get_visible_logs(self) -> list[dict]:
        sev_filter = self._filter_sev.get()
        search     = self._search_var.get().lower()

        return [
            e for e in self._logs
            if (sev_filter == 'ALL' or e['severity'] == sev_filter)
            and (not search or search in e['msg'].lower())
        ]

    # ── Public interface ───────────────────────────────────────────────────────

    def append(self, message: str, severity: str = 'INFO'):
        self._logs.append({
            'time':     datetime.now().strftime('%H:%M:%S'),
            'msg':      message,
            'severity': severity.upper() if severity.upper() in _SEV else 'INFO',
        })
        if self.winfo_ismapped():
            self._refresh(scroll_bottom=True)

    def _clear(self):
        self._logs.clear()
        self._current_page = 1
        self._refresh()

    def _scroll_bottom(self):
        visible = self._get_visible_logs()
        total_pages = max(1, (len(visible) + self._per_page - 1) // self._per_page)
        self._current_page = total_pages
        self._refresh()
        self.after(50, self._scroll.scroll_to_bottom)

    def _refresh(self, scroll_bottom: bool = False, *_):
        for w in self._scroll.inner.winfo_children():
            w.destroy()

        visible = self._get_visible_logs()
        total_items = len(visible)
        total_pages = max(1, (total_items + self._per_page - 1) // self._per_page)

        if self._current_page > total_pages:
            self._current_page = total_pages

        self._count_lbl.config(text=f'Page {self._current_page} of {total_pages} ({total_items} entries)')
        self._prev_btn.config(state='normal' if self._current_page > 1 else 'disabled')
        self._next_btn.config(state='normal' if self._current_page < total_pages else 'disabled')

        # Slice items for current page
        start_idx = (self._current_page - 1) * self._per_page
        end_idx   = start_idx + self._per_page
        page_logs = visible[start_idx:end_idx]

        for entry in page_logs:
            bg, fg, icon = _SEV[entry['severity']]
            row = tk.Frame(self._scroll.inner, bg=bg)
            row.pack(fill='x', pady=1)

            tk.Label(row, text=entry['time'], font=FONT['mono'],
                     fg=C['text_tertiary'], bg=bg, width=10).pack(side='left', padx=(SPACE['sm'], 0))

            tk.Label(row, text=icon, font=('Segoe UI', 10),
                     fg=fg, bg=bg, width=2).pack(side='left')

            tk.Label(row, text=entry['msg'], font=FONT['body_sm'],
                     fg=fg, bg=bg, anchor='w').pack(side='left', fill='x', expand=True,
                                                     padx=(4, SPACE['sm']), pady=3)

        if scroll_bottom:
            self.after(50, self._scroll.scroll_to_bottom)
