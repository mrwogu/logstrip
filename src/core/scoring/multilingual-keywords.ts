/**
 * Multilingual diagnostic keyword detection (opt-in --multilingual).
 *
 * The built-in diagnostic patterns are English-only, so error lines written in
 * other languages slip through unscored. When enabled, lines containing common
 * error/failure/exception keywords in major languages are treated as
 * diagnostic (a +50 boost, identical to the English DIAGNOSTIC_PATTERN).
 *
 * Space-delimited scripts (Latin, Cyrillic) use Unicode letter-boundary
 * lookarounds so substrings inside longer words do not match. CJK scripts have
 * no word boundaries, so those keywords are matched as plain substrings.
 */
const MULTILINGUAL_WORD_PATTERN =
  /(?<!\p{L})(?:erreur|erreurs|errore|errori|erro|erros|fehler|fehlgeschlagen|falla|fallo|fall[oó]|fallido|fallida|fallito|fallita|falha|falhou|[ée]chec|[ée]chou[ée]|excepci[oó]n|exce[çc][aã]o|eccezione|ausnahme|cr[ií]tico|critique|kritisch|rechazado|recusado|refus[ée]|rifiutato|abgelehnt|agotado|esgotado|expir[ée]|scaduto|abgebrochen|impossible|imposible|ошибка|сбой|исключение|отказано|критическ\p{L}*|провал|сбои)(?!\p{L})/iu;

const MULTILINGUAL_CJK_PATTERN =
  /(?:错误|錯誤|失败|失敗|异常|異常|例外|严重|嚴重|致命|エラー|障害)/u;

export function isMultilingualDiagnosticLine(line: string): boolean {
  return (
    MULTILINGUAL_WORD_PATTERN.test(line) || MULTILINGUAL_CJK_PATTERN.test(line)
  );
}
