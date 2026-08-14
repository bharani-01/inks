"""
Disk Logger & Performance Monitor
=================================
Thread-safe persistent disk logger with function execution timing,
click tracking, error tracebacks, and automatic unhandled exception hooks.
Logs stored at ~/.inks_agent/inks_agent.log
"""
import os
import sys
import time
import logging
import traceback
import functools
import threading
from pathlib import Path

# Log directory & file in user home directory
LOG_DIR = Path.home() / '.inks_agent'
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'inks_agent.log'

# Configure standard logging module (safe for --windowed PyInstaller executables)
log_handlers = [logging.FileHandler(str(LOG_FILE), encoding='utf-8')]
if sys.stdout is not None:
    log_handlers.append(logging.StreamHandler(sys.stdout))

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] [%(threadName)s] %(message)s',
    handlers=log_handlers
)

logger = logging.getLogger('InksAgent')


def get_log_file_path() -> str:
    return str(LOG_FILE)


def log_info(msg: str):
    logger.info(msg)


def log_warn(msg: str):
    logger.warning(msg)


def log_error(msg: str, exc: Exception = None):
    if exc:
        tb = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        logger.error(f"{msg}\n{tb}")
    else:
        logger.error(msg)


def log_click(element_name: str, details: str = ''):
    logger.info(f"🖱 UI CLICK: [{element_name}] {f'({details})' if details else ''}")


def time_function(name: str = ''):
    """Decorator to measure function response time in ms and log performance."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            fn_name = name or func.__name__
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                elapsed_ms = (time.perf_counter() - start) * 1000
                logger.debug(f"⏱ FUNC: {fn_name} completed in {elapsed_ms:.2f}ms")
                return result
            except Exception as e:
                elapsed_ms = (time.perf_counter() - start) * 1000
                log_error(f"❌ FUNC: {fn_name} FAILED after {elapsed_ms:.2f}ms: {e}", exc=e)
                raise
        return wrapper
    return decorator


def setup_exception_hooks():
    """Install global exception hooks to capture all unhandled errors into log file."""
    def handle_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            if sys.__excepthook__:
                sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        tb = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        logger.critical(f"💥 UNHANDLED MAIN THREAD EXCEPTION:\n{tb}")

    def handle_thread_exception(args):
        tb = ''.join(traceback.format_exception(args.exc_type, args.exc_value, args.exc_traceback))
        thread_name = getattr(args.thread, 'name', 'WorkerThread')
        logger.critical(f"💥 UNHANDLED THREAD EXCEPTION [{thread_name}]:\n{tb}")

    sys.excepthook = handle_exception
    if hasattr(threading, 'excepthook'):
        threading.excepthook = handle_thread_exception

