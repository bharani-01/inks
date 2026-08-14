"""
Notifier Service
================
Sound alerts and desktop toast notifications.
"""
import sys
import threading
import platform


def play_new_job_sound():
    """Play a chime/beep to alert the operator of a new print job."""
    threading.Thread(target=_play, daemon=True).start()


def _play():
    system = platform.system().lower()
    from pathlib import Path
    assets_dir = Path(sys._MEIPASS) / 'assets' if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS') else Path(__file__).parent.parent.parent / 'assets'
    wav_path = assets_dir / 'chime.wav'

    if system == 'windows':
        try:
            import winsound
            if wav_path.exists():
                winsound.PlaySound(str(wav_path), winsound.SND_FILENAME | winsound.SND_ASYNC)
            else:
                # Fallback: system beep
                winsound.Beep(880, 200)
                winsound.Beep(1100, 150)
        except Exception:
            pass
    elif system in ('linux', 'darwin'):
        try:
            import subprocess
            if wav_path.exists():
                if system == 'linux':
                    subprocess.Popen(['aplay', str(wav_path)], stderr=subprocess.DEVNULL)
                else:
                    subprocess.Popen(['afplay', str(wav_path)], stderr=subprocess.DEVNULL)
        except Exception:
            pass


def show_toast(title: str, message: str):
    """Show a native desktop toast notification without COM thread lock."""
    def _do_toast():
        try:
            system = platform.system().lower()
            if system == 'windows':
                try:
                    import winsound
                    winsound.MessageBeep(winsound.MB_ICONASTERISK)
                except Exception:
                    pass
                return

            from plyer import notification
            notification.notify(
                title=title,
                message=message,
                app_name='Inks Printer Agent',
                timeout=3,
            )
        except Exception:
            pass

    threading.Thread(target=_do_toast, daemon=True).start()
