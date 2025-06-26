@echo off
echo 🚀 Installing Vibe Context Bridge...

echo 📦 Installing core package...
npm install -g vibe-context-bridge.tgz

echo 🔌 Installing VS Code extension...
where code >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    code --install-extension vibe-context-bridge-vscode.vsix
    echo ✅ VS Code extension installed!
) else (
    echo ⚠️  VS Code CLI not found. Please install the extension manually:
    echo    1. Open VS Code
    echo    2. Go to Extensions (Ctrl+Shift+X)
    echo    3. Click '...' → 'Install from VSIX'
    echo    4. Select: vibe-context-bridge-vscode.vsix
)

echo.
echo 🎉 Vibe Context Bridge installed successfully!
echo.
echo 📖 Quick Start:
echo    1. Open your project in VS Code
echo    2. Press Ctrl+Shift+P
echo    3. Type 'Vibe Context: Initialize Project'
echo    4. Follow the setup wizard
echo.
echo 📚 Documentation: https://github.com/minimax-agent/vibe-context-bridge
echo.
pause
