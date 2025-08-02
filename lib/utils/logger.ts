/**
 * Utilitat de Logging Estructurat
 * 
 * Aquesta utilitat proporciona logs estructurats en format JSON que són
 * fàcils de filtrar i analitzar a Vercel Logs o altres sistemes de monitorització.
 */

export interface LogContext {
  generationId?: string;
  projectId?: string;
  userId?: string;
  component: string;
  function?: string;
  [key: string]: any; // Permet camps addicionals
}

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context: LogContext;
  errorMessage?: string;
  stack?: string;
}

/**
 * Crea un log estructurat en format JSON
 */
const createLogEntry = (
  level: LogEntry['level'],
  message: string,
  context: LogContext,
  error?: any
): LogEntry => {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  if (error) {
    if (error instanceof Error) {
      entry.errorMessage = error.message;
      entry.stack = error.stack;
    } else {
      entry.errorMessage = String(error);
    }
  }

  return entry;
};

/**
 * Logger estructurat amb format JSON
 */
export const logger = {
  /**
   * Log informatiu per seguiment normal del procés
   */
  info: (message: string, context: LogContext) => {
    const entry = createLogEntry('info', message, context);
    console.log(JSON.stringify(entry));
  },

  /**
   * Log d'advertència per situacions que requereixen atenció
   */
  warn: (message: string, context: LogContext, error?: any) => {
    const entry = createLogEntry('warn', message, context, error);
    console.warn(JSON.stringify(entry));
  },

  /**
   * Log d'error per situacions crítiques o fallides
   */
  error: (message: string, error: any, context: LogContext) => {
    const entry = createLogEntry('error', message, context, error);
    console.error(JSON.stringify(entry));
  },

  /**
   * Log de mètriques de rendiment
   */
  metrics: (message: string, metrics: Record<string, number>, context: LogContext) => {
    const entry = createLogEntry('info', message, { ...context, metrics });
    console.log(JSON.stringify(entry));
  },
};

/**
 * Factory per crear un logger amb context predefinit
 * Útil per components que sempre tenen el mateix context base
 */
export const createContextLogger = (baseContext: LogContext) => ({
  info: (message: string, additionalContext?: Partial<LogContext>) => 
    logger.info(message, { ...baseContext, ...additionalContext }),
  
  warn: (message: string, error?: any, additionalContext?: Partial<LogContext>) => 
    logger.warn(message, { ...baseContext, ...additionalContext }, error),
  
  error: (message: string, error: any, additionalContext?: Partial<LogContext>) => 
    logger.error(message, error, { ...baseContext, ...additionalContext }),
  
  metrics: (message: string, metrics: Record<string, number>, additionalContext?: Partial<LogContext>) => 
    logger.metrics(message, metrics, { ...baseContext, ...additionalContext }),
});
