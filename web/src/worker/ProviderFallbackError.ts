/** Error raised when every provider in an ordered fallback chain fails */
export class ProvidersUnavailableError extends Error {
  readonly causes: unknown[];

  constructor(message: string, causes: unknown[]) {
    super(message);
    this.name = "ProvidersUnavailableError";
    this.causes = causes;
  }
}
