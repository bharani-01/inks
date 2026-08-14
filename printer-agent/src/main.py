import tkinter as tk

# Fix Python 3.15 Tkinter deletecommand AttributeError on destroyed widgets/callbacks
_orig_deletecommand = tk.Misc.deletecommand
def _safe_deletecommand(self, name):
    try:
        if getattr(self, '_tclCommands', None) is not None:
            _orig_deletecommand(self, name)
    except Exception:
        pass
tk.Misc.deletecommand = _safe_deletecommand

from src.utils.logger import setup_exception_hooks, log_info, get_log_file_path
from src.ui.app import PrinterAgentApp
from src.config.settings import load_settings


def main():
    setup_exception_hooks()
    log_info("==========================================")
    log_info(f"Starting Inks Printer Agent")
    log_info(f"Log File: {get_log_file_path()}")
    log_info("==========================================")
    settings = load_settings()
    app = PrinterAgentApp(settings)
    app.run()


if __name__ == '__main__':
    main()
