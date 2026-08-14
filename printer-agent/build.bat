@echo off
echo =============================================
echo  Inks Printer Agent — PyInstaller Build
echo =============================================
echo.

pip install -r requirements.txt
pip install pyinstaller

echo.
echo Building executable...
echo.

pyinstaller ^
  --onefile ^
  --windowed ^
  --name="InksPrinterAgent" ^
  --add-data="assets;assets" ^
  --add-data=".env.example;." ^
  --hidden-import=PIL._tkinter_finder ^
  --hidden-import=pystray._win32 ^
  --hidden-import=plyer.platforms.win.notification ^
  src\main.py

echo.
echo Build complete! Executable is in dist\InksPrinterAgent.exe
pause
