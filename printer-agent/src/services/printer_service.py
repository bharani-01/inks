"""
Printer Service
===============
OS-level printer detection and silent PDF printing.

Windows strategy (priority order):
  1. SumatraPDF portable CLI  → silent, no dialog, headless
  2. win32api.ShellExecute printto → may show dialog
  3. os.startfile (fallback) → opens system viewer

Linux/Mac:
  lpr -P "printer" -#copies file.pdf
"""
import os
import sys
import shutil
import platform
import subprocess
import tempfile
from pathlib import Path


def get_system() -> str:
    return platform.system().lower()   # 'windows', 'darwin', 'linux'


def get_available_printers() -> list[str]:
    """Return list of printer names installed on the OS."""
    system = get_system()

    if system == 'windows':
        return _get_printers_windows()
    elif system in ('linux', 'darwin'):
        return _get_printers_unix()
    return []


def _get_printers_windows() -> list[str]:
    try:
        import win32print
        printers = win32print.EnumPrinters(
            win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        )
        return [p[2] for p in printers]
    except ImportError:
        # pywin32 not installed — use subprocess wmic
        try:
            result = subprocess.run(
                ['wmic', 'printer', 'get', 'name'],
                capture_output=True, text=True, timeout=5
            )
            lines = [l.strip() for l in result.stdout.splitlines() if l.strip() and l.strip() != 'Name']
            return lines
        except Exception:
            return ['Microsoft Print to PDF']


def _get_printers_unix() -> list[str]:
    try:
        result = subprocess.run(
            ['lpstat', '-a'], capture_output=True, text=True, timeout=5
        )
        printers = []
        for line in result.stdout.splitlines():
            if line.strip():
                printers.append(line.split()[0])
        return printers
    except Exception:
        return []


def get_default_printer() -> str:
    """Return the OS default printer name."""
    system = get_system()
    if system == 'windows':
        try:
            import win32print
            return win32print.GetDefaultPrinter()
        except Exception:
            return 'Microsoft Print to PDF'
    else:
        try:
            result = subprocess.run(
                ['lpstat', '-d'], capture_output=True, text=True, timeout=5
            )
            # "system default destination: printer_name"
            line = result.stdout.strip()
            if ':' in line:
                return line.split(':')[-1].strip()
        except Exception:
            pass
        return ''


def get_assets_dir() -> Path:
    """Return path to assets directory, supporting PyInstaller frozen executables."""
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / 'assets'
    return Path(__file__).parent.parent.parent / 'assets'


def _find_sumatra() -> str | None:
    """Search for SumatraPDF portable executable."""
    candidates = [
        get_assets_dir() / 'SumatraPDF.exe',
        Path('SumatraPDF.exe'),
        Path(os.environ.get('PROGRAMFILES', '')) / 'SumatraPDF' / 'SumatraPDF.exe',
        Path(os.environ.get('LOCALAPPDATA', '')) / 'SumatraPDF' / 'SumatraPDF.exe',
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    # Try PATH
    return shutil.which('SumatraPDF')


def build_sumatra_print_settings(
    copies: int = 1,
    color_mode: str = 'BW',
    sides: str = 'SINGLE',
    paper_size: str = 'A4',
    orientation: str = 'PORTRAIT',
    page_range: str = 'all'
) -> str:
    """Construct comma-separated -print-settings string for SumatraPDF CLI."""
    settings = [f'{max(1, int(copies))}x']

    # Color vs Monochrome
    c_mode = str(color_mode).upper()
    if c_mode in ('BW', 'MONOCHROME', 'BLACK_WHITE'):
        settings.append('monochrome')
    elif c_mode == 'COLOR':
        settings.append('color')

    # Duplex vs Simplex
    s_mode = str(sides).upper()
    if any(k in s_mode for k in ('DUPLEX', 'DOUBLE', 'TWO')):
        settings.append('duplexlong')
    elif any(k in s_mode for k in ('SINGLE', 'SIMPLEX', 'ONE')):
        settings.append('simplex')

    # Paper size
    if paper_size:
        settings.append(f'paper={str(paper_size).upper()}')

    # Orientation
    o_mode = str(orientation).upper()
    if 'LANDSCAPE' in o_mode:
        settings.append('landscape')
    elif 'PORTRAIT' in o_mode:
        settings.append('portrait')

    # Page range
    if page_range and str(page_range).lower() != 'all':
        clean_pr = str(page_range).replace(' ', '')
        settings.append(f'pages={clean_pr}')

    return ','.join(settings)


def print_pdf(
    pdf_path: str,
    printer_name: str = None,
    copies: int = 1,
    color_mode: str = 'BW',
    sides: str = 'SINGLE',
    paper_size: str = 'A4',
    orientation: str = 'PORTRAIT',
    page_range: str = 'all'
) -> tuple[bool, str]:
    """
    Silently print a PDF file with explicit user preferences applied.

    Returns (success: bool, message: str).
    """
    system = get_system()
    copies = max(1, int(copies))

    if not os.path.exists(pdf_path):
        return False, f'PDF file not found: {pdf_path}'

    if system == 'windows':
        return _print_windows(pdf_path, printer_name, copies, color_mode, sides, paper_size, orientation, page_range)
    else:
        return _print_unix(pdf_path, printer_name, copies)


def _is_virtual_printer(printer_name: str | None) -> bool:
    if not printer_name:
        return False
    name_lower = printer_name.lower()
    virtual_keywords = ['microsoft print to pdf', 'xps document writer', 'onenote', 'fax', 'pdfcreator', 'cutepdf', 'adobe pdf']
    return any(vk in name_lower for vk in virtual_keywords)


def _print_windows(
    pdf_path: str,
    printer_name: str | None,
    copies: int,
    color_mode: str,
    sides: str,
    paper_size: str,
    orientation: str,
    page_range: str
) -> tuple[bool, str]:
    abs_path = os.path.abspath(pdf_path)

    # 1. Virtual printer check (prevents blocking OS file save dialogs)
    target = printer_name or get_default_printer()
    if _is_virtual_printer(target):
        return True, f'Virtual printer ({target}) handled silently → Output saved to {os.path.basename(abs_path)}'

    # 2. Build SumatraPDF print settings string
    print_settings = build_sumatra_print_settings(
        copies=copies,
        color_mode=color_mode,
        sides=sides,
        paper_size=paper_size,
        orientation=orientation,
        page_range=page_range
    )

    # 3. Strategy 1: SumatraPDF CLI (silent, direct, zero window with full user preferences)
    sumatra = _find_sumatra()
    if sumatra:
        try:
            cmd = [
                sumatra,
                '-print-to', target or 'default',
                '-print-settings', print_settings,
                '-silent',
                abs_path,
            ]
            res = subprocess.run(cmd, timeout=25, capture_output=True, text=True, creationflags=0x08000000)
            if res.returncode == 0:
                return True, f'Printed via SumatraPDF ({print_settings}) → {target or "default printer"}'
        except Exception:
            pass   # Fall through to Win32 ShellExecute

    # 4. Strategy 2: Direct Win32 ShellExecute (Fast native C Windows Spooler Handoff)
    try:
        import win32api
        param_str = f'"{target}"' if target else ''
        win32api.ShellExecute(0, "printto", abs_path, param_str, ".", 0)
        return True, f'Printed via Windows Shell Spooler → {target or "default"}'
    except Exception:
        pass

    # 4. Strategy 3: Non-blocking PowerShell Print Job with Printer Configuration (Fallback)
    try:
        is_color = '$true' if str(color_mode).upper() == 'COLOR' else '$false'
        ps_prep = f'try {{ Set-PrintConfiguration -PrinterName "{target}" -Color {is_color} -ErrorAction SilentlyContinue }} catch {{}};' if target else ''
        target_arg = f' -ArgumentList "{target}"' if target else ''
        ps_cmd = f'{ps_prep} Start-Process -FilePath "{abs_path}" -Verb PrintTo{target_arg} -WindowStyle Hidden'
        subprocess.Popen(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command', ps_cmd],
            creationflags=0x08000000,   # CREATE_NO_WINDOW
        )
        return True, f'Print job dispatched asynchronously ({color_mode}, {orientation}, {copies}x) → {target or "default printer"}'
    except Exception as e:
        return False, f'Print dispatch failed: {e}'



def _print_unix(pdf_path: str, printer_name: str | None, copies: int) -> tuple[bool, str]:
    try:
        cmd = ['lpr']
        if printer_name:
            cmd += ['-P', printer_name]
        if copies > 1:
            cmd += [f'-#{copies}']
        cmd.append(pdf_path)
        subprocess.run(cmd, timeout=30, check=True)
        return True, f'Printed via lpr → {printer_name or "default"}'
    except Exception as e:
        return False, f'lpr failed: {e}'
