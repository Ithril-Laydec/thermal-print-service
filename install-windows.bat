@echo off
echo 🖨️  Instalador automático de drivers térmicos para Windows
echo =========================================================

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Permisos de administrador detectados
) else (
    echo ❌ Este script necesita permisos de administrador
    echo    Ejecuta como administrador: Clic derecho → "Ejecutar como administrador"
    pause
    exit /b 1
)

echo 📦 Detectando impresoras USB...
wmic printer list brief

echo 🔌 Buscando dispositivos USB...
wmic path win32_pnpentity where "caption like '%%USB%%'" get caption,deviceid

echo 🖨️  Instalando driver genérico para impresora térmica...

REM Instalar impresora como "ALBARAN" con driver genérico
rundll32 printui.dll,PrintUIEntry /if /b "ALBARAN" /f "%windir%\inf\ntprint.inf" /r "nul:" /m "Generic / Text Only"

REM También instalar como "Albaranes"
rundll32 printui.dll,PrintUIEntry /if /b "Albaranes" /f "%windir%\inf\ntprint.inf" /r "nul:" /m "Generic / Text Only"

echo 🎯 Configurando ALBARAN como impresora predeterminada...
rundll32 printui.dll,PrintUIEntry /y /n "ALBARAN"

echo ✅ Instalación completada!
echo.
echo 📋 Próximos pasos:
echo    1. Conecta tu impresora aqprox appPOS80AM por USB
echo    2. Ve a Panel de Control → Dispositivos e impresoras
echo    3. Busca tu impresora térmica y configúrala para usar puerto USB
echo    4. Ejecuta: bun start
echo    5. Prueba desde la aplicación Vue
echo.
echo 🔍 Para verificar:
echo    Control Panel → Devices and Printers
echo.
pause