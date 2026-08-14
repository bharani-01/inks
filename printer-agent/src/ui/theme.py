"""
Premium Light Theme Design System
===================================
Fortune-500-grade design tokens.
Inspired by Linear, Notion, and Figma desktop interfaces.
"""

# ── Color Palette ─────────────────────────────────────────────────────────────

C = {
    # Backgrounds
    'bg_app':       '#F0F2F5',   # Overall app background (light gray)
    'bg_sidebar':   '#FFFFFF',   # Sidebar background
    'bg_content':   '#F8F9FC',   # Page content area
    'bg_card':      '#FFFFFF',   # Card / elevated surface
    'bg_input':     '#FFFFFF',   # Input background
    'bg_hover':     '#F1F5F9',   # Hover state background

    # Text
    'text_primary':   '#0F172A', # slate-900 — main headings, body
    'text_secondary': '#475569', # slate-600 — supporting text
    'text_tertiary':  '#94A3B8', # slate-400 — placeholders, captions
    'text_inverse':   '#FFFFFF', # On dark / accent backgrounds

    # Brand / Accent
    'accent':         '#4F46E5', # indigo-600 — primary action colour
    'accent_dark':    '#3730A3', # indigo-800 — hover/active
    'accent_light':   '#EEF2FF', # indigo-50 — selected sidebar item bg
    'accent_border':  '#C7D2FE', # indigo-200

    # Semantic
    'success':        '#059669', # emerald-600
    'success_light':  '#ECFDF5', # emerald-50
    'success_dark':   '#065F46', # emerald-800
    'warning':        '#D97706', # amber-600
    'warning_light':  '#FFFBEB', # amber-50
    'error':          '#DC2626', # red-600
    'error_light':    '#FEF2F2', # red-50
    'info':           '#0284C7', # sky-600
    'info_light':     '#F0F9FF', # sky-50

    # Status dots
    'online':  '#22C55E',        # green-500
    'offline': '#EF4444',        # red-500
    'paused':  '#F59E0B',        # amber-500

    # Borders & dividers
    'border':       '#E2E8F0',   # slate-200
    'border_subtle':'#F1F5F9',   # slate-100
    'divider':      '#E2E8F0',

    # Sidebar item states
    'sidebar_item_text':     '#475569',  # inactive
    'sidebar_item_active_bg':'#EEF2FF',  # active bg
    'sidebar_item_active_fg':'#4F46E5',  # active text

    # Log severity colours
    'log_info_fg':  '#0F172A',
    'log_warn_fg':  '#D97706',
    'log_error_fg': '#DC2626',
    'log_info_bg':  '#FFFFFF',
    'log_warn_bg':  '#FFFBEB',
    'log_error_bg': '#FEF2F2',

    # Misc
    'white':  '#FFFFFF',
    'black':  '#000000',
    'shadow': '#00000012',
}

# ── Typography ─────────────────────────────────────────────────────────────────

FONT = {
    'h1':        ('Segoe UI Semibold', 18),
    'h2':        ('Segoe UI Semibold', 14),
    'h3':        ('Segoe UI Semibold', 12),
    'h4':        ('Segoe UI Semibold', 11),
    'body':      ('Segoe UI', 10),
    'body_sm':   ('Segoe UI', 9),
    'caption':   ('Segoe UI', 8),
    'mono':      ('Cascadia Code', 9),
    'mono_sm':   ('Cascadia Code', 8),
    'bold':      ('Segoe UI Semibold', 10),
    'label':     ('Segoe UI Semibold', 9),
    'nav':       ('Segoe UI Semibold', 10),
}

# ── Spacing ────────────────────────────────────────────────────────────────────

SPACE = {
    'xxs': 2,
    'xs':  4,
    'sm':  8,
    'md':  12,
    'lg':  16,
    'xl':  24,
    'xxl': 32,
    '3xl': 48,
}

# ── Dimensions ─────────────────────────────────────────────────────────────────

DIM = {
    'sidebar_w':       200,
    'header_h':        56,
    'status_h':        32,
    'card_radius':     8,
    'btn_radius':      6,
    'input_radius':    6,
    'badge_radius':    20,
}

# ── Button Styles (reusable config dicts) ─────────────────────────────────────

BTN = {
    'primary': {
        'bg':     C['accent'],
        'fg':     C['text_inverse'],
        'hover':  C['accent_dark'],
        'active': C['accent_dark'],
        'relief': 'flat',
        'padx':   16,
        'pady':   8,
        'font':   FONT['bold'],
        'cursor': 'hand2',
    },
    'secondary': {
        'bg':     C['bg_card'],
        'fg':     C['text_primary'],
        'hover':  C['bg_hover'],
        'active': C['bg_hover'],
        'relief': 'flat',
        'padx':   14,
        'pady':   7,
        'font':   FONT['bold'],
        'cursor': 'hand2',
        'bd':     1,
        'highlightcolor': C['border'],
    },
    'danger': {
        'bg':     C['error_light'],
        'fg':     C['error'],
        'hover':  '#FEE2E2',
        'active': '#FEE2E2',
        'relief': 'flat',
        'padx':   14,
        'pady':   7,
        'font':   FONT['bold'],
        'cursor': 'hand2',
    },
    'ghost': {
        'bg':     C['bg_content'],
        'fg':     C['text_secondary'],
        'hover':  C['bg_hover'],
        'active': C['bg_hover'],
        'relief': 'flat',
        'padx':   12,
        'pady':   6,
        'font':   FONT['body'],
        'cursor': 'hand2',
    },
}
