# Solución #1 Implementada: iconv-lite para Caracteres Especiales

## ✅ Qué se implementó

Se implementó la **Solución #1** usando `iconv-lite` para convertir correctamente caracteres UTF-8 → CP858 ANTES de enviar a la impresora.

### Cambios principales

1. **Nueva función `encodeTextForPrinter()`** (línea 198)
   - Convierte texto UTF-8 → CP858 (o cualquier encoding)
   - Retorna Buffers binarios en lugar de strings
   - Tiene fallback automático a conversión manual si falla

2. **`printWithLpr()` mejorado** (línea 227)
   - Usa buffers binarios en lugar de strings
   - Prueba múltiples encodings: CP858, CP850, ISO-8859-15, Windows-1252
   - Escribe archivos .bin en lugar de .txt
   - Configura correctamente la página de códigos con ESC/POS

3. **`printDirectToDevice()` mejorado** (línea 118)
   - Usa buffers binarios con CP858
   - Comandos ESC/POS como bytes hexadecimales

4. **Nuevo test `test-iconv.js`**
   - Prueba completa de caracteres especiales (€, á, é, í, ó, ú, ñ, ¡, ¿)
   - Script: `npm run test-iconv`

## 🧪 Cómo probar

### 1. Reiniciar el servidor

```bash
# Terminal 1: Detener servidor actual (Ctrl+C si está corriendo)
# Luego iniciar de nuevo
cd thermal-print-service
npm start
```

### 2. Ejecutar el test

```bash
# Terminal 2: Ejecutar test de iconv-lite
cd thermal-print-service
npm run test-iconv
```

### 3. Verificar el ticket impreso

Busca estos caracteres en el ticket:

- ✅ **€** → debería verse como símbolo de euro (no "EUR")
- ✅ **á, é, í, ó, ú** → con tildes
- ✅ **ñ** → eñe española
- ✅ **¡, ¿** → signos de interrogación/exclamación españoles

## 📊 Encodings probados (en orden)

El sistema intentará estas codificaciones automáticamente:

1. **CP858** (Europa + €) - ⭐ RECOMENDADO
2. **CP850** (Europa sin €)
3. **ISO-8859-15** (Latin-9 con €)
4. **Windows-1252** (Windows Latin)
5. **ASCII manual** (fallback seguro)

## 🔧 Qué hace diferente esta solución

### ANTES (incorrecto)
```javascript
// Enviaba strings JavaScript (UTF-8)
const text = "Precio: 15.50€"
printer.print(text) // ❌ La impresora no entiende UTF-8
```

### AHORA (correcto)
```javascript
// Convierte UTF-8 → CP858 como bytes
const buffer = iconv.encode("Precio: 15.50€", 'CP858')
// buffer = [0x50, 0x72, 0x65, ..., 0xD5] // 0xD5 es € en CP858
printer.print(buffer) // ✅ La impresora entiende CP858
```

## 🐛 Troubleshooting

### Si aún no se ven los caracteres especiales:

1. **Verifica que iconv-lite esté instalado**
   ```bash
   npm list iconv-lite
   # Debería mostrar: iconv-lite@0.7.0
   ```

2. **Verifica en los logs del servidor**
   Busca líneas como:
   ```
   🧪 Probando: CP858 con iconv-lite (€ + tildes)
   Codificación: CP858 (exitosa)
   ✅ Impresión exitosa con Albaranes usando CP858 con iconv-lite (€ + tildes)
   ```

3. **Si usa "Conversión manual ASCII"**
   Significa que iconv-lite falló. Intenta:
   ```bash
   npm install --save iconv-lite
   ```

## 🚀 Siguientes pasos (si esto no funciona)

Si después de esta implementación los caracteres aún no se ven bien:

1. **Solución #3**: Reconfigura CUPS para modo RAW (elimina filtros)
2. **Solución #2**: Habilita UTF-8 nativo con comandos GS (C (para impresoras modernas)
3. **Solución #6**: Usa Python-escpos (mejor compatibilidad)

## 📝 Notas técnicas

- **CP858** es CP850 + el símbolo €
- **Byte del €**: 0xD5 en CP858, 0x80 en CP1252
- **ESC/POS**: `ESC t [n]` configura la página de códigos
  - `ESC t 19` = CP858/CP850
  - `ESC t 16` = CP1252
  - `ESC t 15` = ISO-8859-15

## 📚 Referencias

- iconv-lite: https://github.com/ashtuchkin/iconv-lite
- ESC/POS Character Codes: https://reference.epson-biz.com/modules/ref_escpos/index.php?content_id=32
- CP858 Code Page: https://en.wikipedia.org/wiki/Code_page_858