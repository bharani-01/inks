"""
Reusable custom Tkinter widgets for the Inks Printer Agent.
Premium-grade, hover-animated, consistent with the design system.
"""
import tkinter as tk
from src.ui.theme import C, FONT, SPACE, DIM, BTN


# ──────────────────────────────────────────────────────────────────────────────
# PremiumButton — animated hover/active states
# ──────────────────────────────────────────────────────────────────────────────

class PremiumButton(tk.Button):
    """A flat button with smooth hover colour transitions."""

    def __init__(self, parent, style='primary', text='', command=None, **kwargs):
        cfg = BTN.get(style, BTN['primary']).copy()
        cfg.update(kwargs)
        hover_bg  = cfg.pop('hover',  cfg['bg'])
        active_bg = cfg.pop('active', cfg['bg'])
        normal_bg = cfg['bg']

        super().__init__(
            parent,
            text=text,
            command=command,
            relief=cfg.get('relief', 'flat'),
            bd=cfg.get('bd', 0),
            bg=normal_bg,
            fg=cfg.get('fg', C['text_primary']),
            activebackground=active_bg,
            activeforeground=cfg.get('fg', C['text_primary']),
            font=cfg.get('font', FONT['bold']),
            padx=cfg.get('padx', 14),
            pady=cfg.get('pady', 7),
            cursor=cfg.get('cursor', 'hand2'),
            highlightthickness=0,
        )
        self._normal_bg = normal_bg
        self._hover_bg  = hover_bg

        self.bind('<Enter>', lambda *e: self.config(bg=self._hover_bg))
        self.bind('<Leave>', lambda *e: self.config(bg=self._normal_bg))


# ──────────────────────────────────────────────────────────────────────────────
# Card — elevated white container with border
# ──────────────────────────────────────────────────────────────────────────────

class Card(tk.Frame):
    """White elevated card with 1-px border."""

    def __init__(self, parent, **kwargs):
        kwargs.setdefault('bg', C['bg_card'])
        kwargs.setdefault('relief', 'flat')
        kwargs.setdefault('highlightbackground', C['border'])
        kwargs.setdefault('highlightthickness', 1)
        super().__init__(parent, **kwargs)


# ──────────────────────────────────────────────────────────────────────────────
# Badge — coloured status pill
# ──────────────────────────────────────────────────────────────────────────────

BADGE_PRESETS = {
    'success': (C['success_light'], C['success_dark']),
    'warning': (C['warning_light'], C['warning']),
    'error':   (C['error_light'],   C['error']),
    'info':    (C['info_light'],    C['info']),
    'accent':  (C['accent_light'],  C['accent']),
    'muted':   (C['bg_hover'],      C['text_secondary']),
    'bw':      ('#F1F5F9',          '#334155'),
    'color':   ('#EEF2FF',          C['accent']),
}

class Badge(tk.Label):
    """Coloured pill badge."""

    def __init__(self, parent, text='', preset='accent', **kwargs):
        bg, fg = BADGE_PRESETS.get(preset, BADGE_PRESETS['muted'])
        super().__init__(
            parent,
            text=text,
            bg=bg,
            fg=fg,
            font=FONT['label'],
            padx=8,
            pady=2,
            relief='flat',
            **kwargs,
        )

    def update_preset(self, preset: str, text: str = None):
        bg, fg = BADGE_PRESETS.get(preset, BADGE_PRESETS['muted'])
        self.config(bg=bg, fg=fg)
        if text is not None:
            self.config(text=text)


# ──────────────────────────────────────────────────────────────────────────────
# StatusDot — animated colored circle
# ──────────────────────────────────────────────────────────────────────────────

class StatusDot(tk.Canvas):
    """A small coloured dot (online / offline / paused)."""
    _SIZE = 10

    def __init__(self, parent, status='offline', **kwargs):
        kwargs.setdefault('width', self._SIZE)
        kwargs.setdefault('height', self._SIZE)
        kwargs.setdefault('highlightthickness', 0)
        super().__init__(parent, **kwargs)
        self._oval = None
        self.set(status)

    def set(self, status: str):
        color_map = {
            'online':  C['online'],
            'offline': C['offline'],
            'paused':  C['paused'],
        }
        color = color_map.get(status, C['offline'])
        s = self._SIZE
        if self._oval:
            self.itemconfig(self._oval, fill=color, outline=color)
        else:
            self._oval = self.create_oval(1, 1, s - 1, s - 1, fill=color, outline=color)


# ──────────────────────────────────────────────────────────────────────────────
# LabeledInput — styled input with floating label
# ──────────────────────────────────────────────────────────────────────────────

class LabeledInput(tk.Frame):
    """Label + Entry pair styled to match the design system."""

    def __init__(self, parent, label='', show=None, **kwargs):
        super().__init__(parent, bg=kwargs.pop('bg', C['bg_card']))

        tk.Label(
            self,
            text=label,
            font=FONT['label'],
            fg=C['text_secondary'],
            bg=self['bg'],
        ).pack(anchor='w', pady=(0, 3))

        self._var = tk.StringVar()
        entry_cfg = dict(
            textvariable=self._var,
            font=FONT['body'],
            bg=C['bg_input'],
            fg=C['text_primary'],
            relief='flat',
            highlightbackground=C['border'],
            highlightcolor=C['accent'],
            highlightthickness=1,
            insertbackground=C['accent'],
            bd=0,
        )
        if show:
            entry_cfg['show'] = show

        self._entry = tk.Entry(self, **entry_cfg)
        self._entry.pack(fill='x', ipady=7, ipadx=8)

    @property
    def value(self) -> str:
        return self._var.get().strip()

    def set(self, text: str):
        self._var.set(text)

    def bind_return(self, callback):
        self._entry.bind('<Return>', callback)

    def focus(self):
        self._entry.focus_set()


# ──────────────────────────────────────────────────────────────────────────────
# StyledCombobox — custom dropdown matching design system
# ──────────────────────────────────────────────────────────────────────────────

class StyledCombobox(tk.Frame):
    """Label + OptionMenu pair styled to match the design system."""

    def __init__(self, parent, label='', options=None, bg=None, **kwargs):
        bg = bg or C['bg_card']
        super().__init__(parent, bg=bg)

        if label:
            tk.Label(
                self,
                text=label,
                font=FONT['label'],
                fg=C['text_secondary'],
                bg=bg,
            ).pack(anchor='w', pady=(0, 3))

        self._var = tk.StringVar()
        self._combo_items = options or []

        self._menu = tk.OptionMenu(self, self._var, *self._combo_items if self._combo_items else [''])
        self._menu.config(
            font=FONT['body'],
            bg=C['bg_input'],
            fg=C['text_primary'],
            activebackground=C['bg_hover'],
            activeforeground=C['text_primary'],
            relief='flat',
            highlightthickness=1,
            highlightbackground=C['border'],
            bd=0,
            cursor='hand2',
            anchor='w',
        )
        self._menu['menu'].config(
            font=FONT['body'],
            bg=C['bg_card'],
            fg=C['text_primary'],
            activebackground=C['accent_light'],
            activeforeground=C['accent'],
            relief='flat',
            bd=0,
        )
        self._menu.pack(fill='x')

    @property
    def value(self) -> str:
        return self._var.get()

    def set(self, val: str):
        self._var.set(val)

    def update_options(self, options: list[str], selected: str = ''):
        menu = self._menu['menu']
        menu.delete(0, 'end')
        self._combo_items = options
        for opt in options:
            menu.add_command(
                label=opt,
                command=lambda v=opt: self._var.set(v),
            )
        if selected and selected in options:
            self._var.set(selected)
        elif options:
            self._var.set(options[0])
        else:
            self._var.set('')

    def trace(self, callback):
        self._var.trace_add('write', callback)


# ──────────────────────────────────────────────────────────────────────────────
# SectionHeader — section label with optional horizontal rule
# ──────────────────────────────────────────────────────────────────────────────

class SectionHeader(tk.Frame):
    """A labelled section divider."""

    def __init__(self, parent, text='', bg=None, **kwargs):
        bg = bg or C['bg_content']
        super().__init__(parent, bg=bg)

        tk.Label(
            self,
            text=text.upper(),
            font=FONT['label'],
            fg=C['text_tertiary'],
            bg=bg,
            padx=0,
        ).pack(anchor='w')

        tk.Frame(self, height=1, bg=C['border']).pack(fill='x', pady=(4, 0))


# ──────────────────────────────────────────────────────────────────────────────
# Divider — thin horizontal line
# ──────────────────────────────────────────────────────────────────────────────

class Divider(tk.Frame):
    def __init__(self, parent, **kwargs):
        kwargs.setdefault('height', 1)
        kwargs.setdefault('bg', C['border'])
        super().__init__(parent, **kwargs)


# ──────────────────────────────────────────────────────────────────────────────
# ScrollableFrame — canvas-backed scrollable container
# ──────────────────────────────────────────────────────────────────────────────

class ScrollableFrame(tk.Frame):
    """A vertically scrollable frame using Canvas + Scrollbar."""

    def __init__(self, parent, bg=None, **kwargs):
        bg = bg or C['bg_content']
        super().__init__(parent, bg=bg, **kwargs)

        self._canvas = tk.Canvas(self, bg=bg, highlightthickness=0)
        self._scrollbar = tk.Scrollbar(self, orient='vertical', command=self._canvas.yview)
        self.inner = tk.Frame(self._canvas, bg=bg)

        self._canvas.configure(yscrollcommand=self._scrollbar.set)
        self._scrollbar.pack(side='right', fill='y')
        self._canvas.pack(side='left', fill='both', expand=True)

        self._window = self._canvas.create_window((0, 0), window=self.inner, anchor='nw')

        self.inner.bind('<Configure>', self._on_inner_configure)
        self._canvas.bind('<Configure>', self._on_canvas_resize)
        self._canvas.bind('<MouseWheel>', self._on_mousewheel)
        self.inner.bind('<MouseWheel>', self._on_mousewheel)

    def _on_inner_configure(self, _):
        self._canvas.configure(scrollregion=self._canvas.bbox('all'))

    def _on_canvas_resize(self, event):
        self._canvas.itemconfig(self._window, width=event.width)

    def _on_mousewheel(self, event):
        self._canvas.yview_scroll(int(-1 * (event.delta / 40)), 'units')

    def scroll_to_bottom(self):
        self._canvas.yview_moveto(1.0)
