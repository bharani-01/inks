"""
Settings Page
=============
Printer selector, print mode, poll interval, alerts, tray, and save folder.
All changes are persisted to .json cache immediately.
"""
import tkinter as tk
from pathlib import Path
from tkinter import filedialog

from src.ui.theme import C, FONT, SPACE
from src.ui.widgets.components import (
    Card, PremiumButton, StyledCombobox, SectionHeader, Divider
)
from src.services.notifier import show_toast
from src.services.printer_service import get_available_printers, get_default_printer


class SettingsPage(tk.Frame):

    def __init__(self, parent, app_controller, **kwargs):
        super().__init__(parent, bg=C['bg_content'], **kwargs)
        self._ctrl = app_controller
        self._is_loading = True
        self._build()
        self._load_current()
        self._attach_auto_save_listeners()
        self._is_loading = False

    # ── Build ──────────────────────────────────────────────────────────────────

    def _build(self):
        pad = SPACE['xl']

        # Page title
        hdr = tk.Frame(self, bg=C['bg_content'])
        hdr.pack(fill='x', padx=pad, pady=(pad, SPACE['sm']))

        tk.Label(hdr, text='Settings', font=FONT['h2'],
                 bg=C['bg_content'], fg=C['text_primary']).pack(anchor='w')
        tk.Label(hdr, text='Configure printer, print mode, and agent behaviour (Auto-saved instantly)',
                 font=FONT['body'], bg=C['bg_content'],
                 fg=C['text_secondary']).pack(anchor='w')

        Divider(self).pack(fill='x', padx=pad, pady=(0, pad))

        content = tk.Frame(self, bg=C['bg_content'])
        content.pack(fill='both', expand=True, padx=pad, pady=(0, pad))
        content.columnconfigure(0, weight=1)
        content.columnconfigure(1, weight=1)

        # ── Left column ───────────────────────────────────────────────────────
        left = tk.Frame(content, bg=C['bg_content'])
        left.grid(row=0, column=0, sticky='nsew', padx=(0, SPACE['md']))

        # Printer card
        self._build_printer_card(left)

        # Print Mode card
        self._build_mode_card(left)

        # ── Right column ──────────────────────────────────────────────────────
        right = tk.Frame(content, bg=C['bg_content'])
        right.grid(row=0, column=1, sticky='nsew')

        # Poll interval card
        self._build_poll_card(right)

        # Alerts & Behaviour card
        self._build_alerts_card(right)

        # Save folder card
        self._build_save_card(right)

        # Bottom status row
        bottom_row = tk.Frame(self, bg=C['bg_content'])
        bottom_row.pack(fill='x', padx=pad, pady=(0, pad))

        self._saved_lbl = tk.Label(
            bottom_row, text='✓ All settings saved & live', font=FONT['bold'],
            bg=C['bg_content'], fg=C['success']
        )
        self._saved_lbl.pack(side='right')

    def _section_card(self, parent, title: str) -> tuple[Card, tk.Frame]:
        card = Card(parent)
        card.pack(fill='x', pady=(0, SPACE['md']))
        inner = tk.Frame(card, bg=C['bg_card'])
        inner.pack(fill='x', padx=SPACE['lg'], pady=SPACE['md'])
        SectionHeader(inner, text=title, bg=C['bg_card']).pack(fill='x', pady=(0, SPACE['md']))
        return card, inner

    def _build_printer_card(self, parent):
        _, inner = self._section_card(parent, 'Printer')

        # Printer dropdown
        printers = get_available_printers()
        default  = get_default_printer()
        current  = self._ctrl.settings.printer_name or default

        self._printer_combo = StyledCombobox(
            inner, label='Selected Printer', options=printers, bg=C['bg_card']
        )
        self._printer_combo.set(current if current in printers else (printers[0] if printers else ''))
        self._printer_combo.pack(fill='x', pady=(0, SPACE['sm']))

        # Bind combobox change
        if hasattr(self._printer_combo, '_combo'):
            self._printer_combo._combo.bind('<<ComboboxSelected>>', lambda e: self._on_setting_changed('Printer'))

        PremiumButton(inner, style='ghost', text='🔄 Refresh Printer List',
                      command=self._refresh_printers).pack(anchor='w')

    def _build_mode_card(self, parent):
        _, inner = self._section_card(parent, 'Print Mode')

        self._mode_var = tk.StringVar(value='manual')

        modes = [
            ('manual',       '✋  Manual — click Print for each job'),
            ('auto',         '⚡  Auto — print after confirmation delay'),
        ]
        for value, label in modes:
            tk.Radiobutton(
                inner, text=label, variable=self._mode_var, value=value,
                font=FONT['body'], bg=C['bg_card'], fg=C['text_primary'],
                activebackground=C['bg_card'], selectcolor=C['bg_card'],
                highlightthickness=0, cursor='hand2',
            ).pack(anchor='w', pady=2)

        # Auto delay (only relevant for auto mode)
        delay_row = tk.Frame(inner, bg=C['bg_card'])
        delay_row.pack(fill='x', pady=(SPACE['sm'], 0))

        tk.Label(delay_row, text='Auto-print delay:', font=FONT['body'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(side='left')

        self._delay_var = tk.IntVar(value=10)
        tk.Spinbox(
            delay_row, from_=3, to=60, textvariable=self._delay_var,
            font=FONT['body'], width=5, relief='flat',
            highlightbackground=C['border'], highlightthickness=1,
        ).pack(side='left', padx=SPACE['sm'])

        tk.Label(delay_row, text='seconds', font=FONT['body'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(side='left')

    def _build_poll_card(self, parent):
        _, inner = self._section_card(parent, 'Connection')

        row = tk.Frame(inner, bg=C['bg_card'])
        row.pack(fill='x')

        tk.Label(row, text='Poll interval:', font=FONT['body'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(side='left')

        self._poll_var = tk.IntVar(value=10)
        tk.Spinbox(
            row, from_=5, to=60, textvariable=self._poll_var,
            font=FONT['body'], width=5, relief='flat',
            highlightbackground=C['border'], highlightthickness=1,
        ).pack(side='left', padx=SPACE['sm'])

        tk.Label(row, text='seconds', font=FONT['body'],
                 bg=C['bg_card'], fg=C['text_secondary']).pack(side='left')

    def _build_alerts_card(self, parent):
        _, inner = self._section_card(parent, 'Alerts & Behaviour')

        self._sound_var = tk.BooleanVar(value=True)
        self._tray_var  = tk.BooleanVar(value=True)

        for var, label in [
            (self._sound_var, '🔔  Sound alert on new job'),
            (self._tray_var,  '📌  Minimize to system tray on close'),
        ]:
            tk.Checkbutton(
                inner, text=label, variable=var,
                font=FONT['body'], bg=C['bg_card'], fg=C['text_primary'],
                activebackground=C['bg_card'], selectcolor=C['accent_light'],
                highlightthickness=0, cursor='hand2',
            ).pack(anchor='w', pady=2)

    def _build_save_card(self, parent):
        _, inner = self._section_card(parent, 'Local Save Folder')

        tk.Label(inner,
                 text='Downloaded PDFs are saved here automatically.',
                 font=FONT['body_sm'], bg=C['bg_card'], fg=C['text_secondary'],
                 wraplength=280, justify='left').pack(anchor='w', pady=(0, SPACE['sm']))

        folder_row = tk.Frame(inner, bg=C['bg_card'])
        folder_row.pack(fill='x')

        self._folder_var = tk.StringVar()
        tk.Entry(
            folder_row, textvariable=self._folder_var,
            font=FONT['body_sm'], bg=C['bg_input'], fg=C['text_primary'],
            relief='flat', highlightbackground=C['border'], highlightthickness=1,
        ).pack(side='left', fill='x', expand=True, ipady=5, ipadx=6)

        PremiumButton(folder_row, style='secondary', text='Browse…',
                      command=self._browse_folder).pack(side='left', padx=(SPACE['sm'], 0))

    # ── Logic ──────────────────────────────────────────────────────────────────

    def _load_current(self):
        s = self._ctrl.settings
        self._mode_var.set('auto' if s.auto_print else 'manual')
        self._delay_var.set(s.auto_print_delay)
        self._poll_var.set(s.poll_interval)
        self._sound_var.set(s.sound_alerts)
        self._tray_var.set(s.minimize_to_tray)
        self._folder_var.set(s.save_folder)

    def _attach_auto_save_listeners(self):
        """Attach automatic instant auto-save trace listeners to all settings variables."""
        for var, name in [
            (self._mode_var, 'Print Mode'),
            (self._delay_var, 'Auto-print Delay'),
            (self._poll_var, 'Poll Interval'),
            (self._sound_var, 'Sound Alerts'),
            (self._tray_var, 'Minimize to Tray'),
            (self._folder_var, 'Save Folder'),
        ]:
            var.trace_add('write', lambda *args, setting_name=name: self._on_setting_changed(setting_name))

    def _on_setting_changed(self, setting_name: str = 'Setting'):
        if getattr(self, '_is_loading', False):
            return
        self._save(notify_name=setting_name)

    def _refresh_printers(self):
        printers = get_available_printers()
        current  = self._printer_combo.value
        self._printer_combo.update_options(printers, selected=current)
        self._save(notify_name='Printer List')

    def _browse_folder(self):
        folder = filedialog.askdirectory(title='Select Save Folder')
        if folder:
            self._folder_var.set(folder)

    def _save(self, notify_name: str = None):
        s = self._ctrl.settings
        s.printer_name    = self._printer_combo.value
        s.auto_print      = (self._mode_var.get() == 'auto')
        s.auto_print_delay= self._delay_var.get()
        s.poll_interval   = self._poll_var.get()
        s.sound_alerts    = self._sound_var.get()
        s.minimize_to_tray= self._tray_var.get()
        s.save_folder     = self._folder_var.get()
        s.save()

        # Apply live changes immediately
        self._ctrl.apply_settings()

        label_txt = f"✓ {notify_name or 'Settings'} updated & live"
        self._saved_lbl.config(text=label_txt)

        if notify_name and not getattr(self, '_is_loading', False):
            show_toast('Setting Updated', f'{notify_name} saved and applied instantly.')
            self._ctrl.log(f'⚡ Setting updated instantly: {notify_name}')

        self.after(3000, lambda: self._saved_lbl.config(text='✓ All settings saved & live'))

