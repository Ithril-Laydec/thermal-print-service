const iconv = require('iconv-lite')

/**
 * Normalizar caracteres Unicode que NO existen en CP858
 * CP858 solo tiene 256 caracteres (ASCII + Europa), sin emojis ni Unicode avanzado
 */
function normalizeUnicodeForCP858(text) {
  return text
    // Box drawing / Líneas decorativas
    .replace(/[─═━]/g, '=')   // Líneas horizontales → igual
    .replace(/[│║┃]/g, '|')   // Líneas verticales → pipe
    .replace(/[┌┐└┘├┤┬┴┼]/g, '+')  // Esquinas → plus

    // Bullets / Viñetas
    .replace(/[•●∙◦]/g, '*')  // Bullets → asterisco
    .replace(/[▪▫]/g, '-')    // Cuadrados → guión

    // Checkmarks / Marcas
    .replace(/[✓✔]/g, 'OK')   // Check simple → OK
    .replace(/[✅]/g, '[OK]')  // Emoji check → [OK]
    .replace(/[✗✘]/g, 'X')    // Cross → X
    .replace(/[❌]/g, '[X]')   // Emoji cross → [X]

    // Emojis comunes
    .replace(/[🧪]/g, '[TEST]')
    .replace(/[✨]/g, '*')
    .replace(/[🎉]/g, '!')
    .replace(/[⚠️]/g, '!')
    .replace(/[🔧]/g, '[CONFIG]')
    .replace(/[📄]/g, '[DOC]')

    // Quotes / Comillas
    .replace(/[""]/g, '"')    // Smart quotes → comillas normales
    .replace(/['']/g, "'")    // Smart apostrophes
    .replace(/[«»]/g, '"')    // Comillas angulares

    // Otros símbolos
    .replace(/[…]/g, '...')   // Ellipsis
    .replace(/[—–]/g, '-')    // Em dash, en dash → guión

    // Flechas
    .replace(/[→⇒➜➔]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[↑]/g, '^')
    .replace(/[↓]/g, 'v')
}

/**
 * Función MEJORADA: Convertir texto UTF-8 → CP858 con iconv-lite
 */
function encodeTextForPrinter(text, encoding = 'CP858') {
  try {
    // Paso 1: Normalizar caracteres Unicode que no existen en CP858
    const normalizedText = normalizeUnicodeForCP858(text)

    // Paso 2: Convertir UTF-8 → CP858 (incluye € y tildes españolas)
    const buffer = iconv.encode(normalizedText, encoding)
    return { buffer, success: true, encoding }
  } catch (error) {
    console.log(`⚠️  Error codificando con ${encoding}:`, error.message)
    // Fallback: convertir manualmente
    const fallbackText = normalizeUnicodeForCP858(text)
      .replace(/€/g, 'EUR')
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[ÁÀÄÂ]/g, 'A')
      .replace(/[ÉÈËÊ]/g, 'E')
      .replace(/[ÍÌÏÎ]/g, 'I')
      .replace(/[ÓÒÖÔ]/g, 'O')
      .replace(/[ÚÙÜÛ]/g, 'U')
      .replace(/Ñ/g, 'N')
      .replace(/¿/g, '?')
      .replace(/¡/g, '!')
    return { buffer: Buffer.from(fallbackText, 'ascii'), success: false, encoding: 'ASCII-fallback' }
  }
}

/**
 * Función para convertir caracteres SOLO si es necesario
 */
function fixSpecialCharacters(text, fallbackMode = false) {
  if (!fallbackMode) {
    // Intentar primero SIN conversión - las impresoras modernas deberían soportar UTF-8/CP850
    return text
  }

  // Solo usar conversiones como último recurso
  const charMap = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
    'ñ': 'n', 'Ñ': 'N',
    'ü': 'u', 'Ü': 'U',
    '€': 'EUR', // Solo como último recurso
    '°': 'o',
    'ç': 'c', 'Ç': 'C'
  }

  let fixedText = text
  for (const [char, replacement] of Object.entries(charMap)) {
    fixedText = fixedText.replace(new RegExp(char, 'g'), replacement)
  }

  return fixedText
}

module.exports = {
  normalizeUnicodeForCP858,
  encodeTextForPrinter,
  fixSpecialCharacters
}