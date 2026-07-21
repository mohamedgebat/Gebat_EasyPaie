@echo off
echo ========================================
echo Installation Gebat EasyPaie
echo ========================================
echo.

echo Verification de Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js n'est pas installe ou pas dans le PATH
    pause
    exit /b 1
)

echo.
echo Installation des dependances...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Echec de l'installation des dependances
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation terminee avec succes!
echo ========================================
echo.
echo Pour demarrer l'application:
echo 1. Ouvrez un terminal et executez: npm run server
echo 2. Dans un autre terminal, executez: npm run dev
echo 3. Ouvrez http://localhost:3000 dans votre navigateur
echo.
pause
