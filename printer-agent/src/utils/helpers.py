"""
Helpers — misc shared utilities.
"""
import os
import sys
import platform
from pathlib import Path


def get_os() -> str:
    return platform.system()  # 'Windows', 'Linux', 'Darwin'


def is_windows() -> bool:
    return get_os() == 'Windows'


def open_folder(folder_path: str):
    """Open a folder in the OS file explorer."""
    path = Path(folder_path)
    path.mkdir(parents=True, exist_ok=True)
    if is_windows():
        os.startfile(str(path))
    elif get_os() == 'Darwin':
        import subprocess
        subprocess.Popen(['open', str(path)])
    else:
        import subprocess
        subprocess.Popen(['xdg-open', str(path)])


def format_filesize(bytes_: int) -> str:
    if bytes_ < 1024:
        return f'{bytes_} B'
    elif bytes_ < 1024 ** 2:
        return f'{bytes_ / 1024:.1f} KB'
    else:
        return f'{bytes_ / 1024 ** 2:.1f} MB'


def truncate(text: str, max_len: int = 40) -> str:
    return text if len(text) <= max_len else text[:max_len - 1] + '…'
