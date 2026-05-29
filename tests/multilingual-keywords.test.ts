import { describe, expect, it } from 'vitest';
import { isMultilingualDiagnosticLine } from '../src/core/scoring/multilingual-keywords';

describe('isMultilingualDiagnosticLine', () => {
  it('matches Latin-script error keywords', () => {
    expect(isMultilingualDiagnosticLine('La connexion a échoué')).toBe(true);
    expect(isMultilingualDiagnosticLine('Verbindung fehlgeschlagen')).toBe(true);
    expect(isMultilingualDiagnosticLine('No se pudo conectar: fallo de red')).toBe(true);
    expect(isMultilingualDiagnosticLine('Errore critico durante il deploy')).toBe(true);
    expect(isMultilingualDiagnosticLine('Произошла ошибка соединения')).toBe(true);
  });

  it('matches CJK error keywords as substrings', () => {
    expect(isMultilingualDiagnosticLine('数据库连接失败')).toBe(true);
    expect(isMultilingualDiagnosticLine('エラーが発生しました')).toBe(true);
    expect(isMultilingualDiagnosticLine('系统发生严重错误')).toBe(true);
  });

  it('does not match unrelated text or partial words', () => {
    expect(isMultilingualDiagnosticLine('all systems nominal')).toBe(false);
    expect(isMultilingualDiagnosticLine('processing fallout shelter')).toBe(false);
    expect(isMultilingualDiagnosticLine('deploying release v1.2.3')).toBe(false);
  });
});
