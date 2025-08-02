/**
 * Utilitat de Reintent amb Exponential Backoff
 * 
 * Aquesta utilitat permet reintentar operacions asíncrones que poden fallar
 * temporalment (ex: crides a APIs externes, errors de xarxa).
 */

export interface RetryOptions {
  retries: number;
  delay: number;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Executa una funció asíncrona amb lògica de reintent
 * 
 * @param fn - Funció asíncrona a executar
 * @param options - Opcions de configuració del reintent
 * @returns Promesa amb el resultat de la funció
 */
export const retryAsync = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  const { retries, delay, onRetry, shouldRetry } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Si hi ha una funció per determinar si cal reintentar
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Si és l'últim intent, llançar l'error
      if (attempt === retries - 1) {
        break;
      }
      
      // Cridar callback de reintent si existeix
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }
      
      // Exponential backoff: delay * 2^attempt
      const backoffDelay = delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError;
};

/**
 * Funció helper per determinar si un error de HTTP val la pena reintentar
 */
export const shouldRetryHttpError = (error: Error): boolean => {
  // Reintentar només en errors de servidor (5xx) o rate limiting (429)
  if (error.message.includes('500') || 
      error.message.includes('502') || 
      error.message.includes('503') || 
      error.message.includes('504') || 
      error.message.includes('429')) {
    return true;
  }
  
  // Reintentar en errors de xarxa genèrics
  if (error.message.includes('fetch') || 
      error.message.includes('network') || 
      error.message.includes('timeout')) {
    return true;
  }
  
  return false;
};

/**
 * Configuració per defecte per a crides a APIs externes
 */
export const DEFAULT_API_RETRY_CONFIG: RetryOptions = {
  retries: 3,
  delay: 1000, // 1 segon inicial
  shouldRetry: shouldRetryHttpError,
};
