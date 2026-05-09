/**
 * Normaliza strings para comparação:
 * - Remove acentos
 * - Converte para maiúsculas
 * - Remove espaços extras
 */
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normaliza nomes de colunas/campos:
 * - Remove acentos
 * - Converte para minúsculas
 * - Substitui espaços por underscore
 */
function normalizeHeader(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

module.exports = { normalizeString, normalizeHeader };
