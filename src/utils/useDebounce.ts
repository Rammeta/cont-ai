import { useState, useEffect } from "react";

/**
 * Hook para debouncing de valores com alta frequência de atualização (ex: campos de busca).
 * Evita execuções pesadas de filtros e re-renderizações a cada caractere digitado.
 *
 * @param value Valor a ser debounced
 * @param delay Tempo em milissegundos (padrão: 250ms)
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
