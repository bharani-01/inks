"""
System Tray Integration
=======================
Uses pystray to create a taskbar tray icon.
"""
import sys
import threading
from pathlib import Path


def create_tray_icon(on_show, on_quit):
    """
    Creates and starts a pystray tray icon in a background thread.
    Returns the pystray.Icon object so it can be stopped later.
    """
    import pystray
    from PIL import Image

    # Load icon image
    assets_dir = Path(sys._MEIPASS) / 'assets' if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS') else Path(__file__).parent.parent.parent / 'assets'
    icon_path = assets_dir / 'icon.png'
    if icon_path.exists():
        img = Image.open(icon_path).resize((64, 64))
    else:
        # Generate a simple colored square as fallback
        img = Image.new('RGB', (64, 64), color='#4F46E5')

    menu = pystray.Menu(
        pystray.MenuItem('Show Window', lambda icon, item: _show(icon, on_show), default=True),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem('Quit', lambda icon, item: _quit(icon, on_quit)),
    )

    icon = pystray.Icon('InksPrinterAgent', img, 'Inks Printer Agent', menu)

    def _run():
        icon.run()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return icon


def _show(icon, on_show):
    icon.stop()
    on_show()


def _quit(icon, on_quit):
    icon.stop()
    on_quit()
