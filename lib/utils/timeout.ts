/**
 * Embolcalla una promesa amb un mecanisme de timeout.
 * Si la promesa no es resol dins del temps especificat, es rebutja amb un error de timeout.
 * 
 * @param promise La promesa a la qual s'aplicarà el timeout.
 * @param ms El temps en mil·lisegons abans que el timeout s'activi.
 * @param timeoutMessage El missatge d'error personalitzat per al timeout.
 * @returns Una nova promesa que es resol amb el valor de la promesa original o es rebutja.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = `Operació ha superat el límit de temps de ${ms}ms`
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(timeoutMessage));
    }, ms);
  });

  return Promise.race([promise, timeout]);
}