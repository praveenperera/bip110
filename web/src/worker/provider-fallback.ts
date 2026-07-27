/** Successful value returned by one provider in an ordered fallback chain */
export interface ProviderResult<Provider, Value> {
  provider: Provider;
  value: Value;
}

/** Error raised when every provider in an ordered fallback chain fails */
export class ProvidersUnavailableError extends Error {
  readonly causes: unknown[];

  constructor(message: string, causes: unknown[]) {
    super(message);
    this.name = "ProvidersUnavailableError";
    this.causes = causes;
  }
}

/** Reads providers in priority order and returns the first successful value */
export async function readFirstAvailable<Provider, Value>(
  providers: readonly Provider[],
  read: (provider: Provider) => Promise<Value>,
  unavailableMessage: string,
): Promise<ProviderResult<Provider, Value>> {
  const causes: unknown[] = [];

  for (const provider of providers) {
    try {
      return { provider, value: await read(provider) };
    } catch (error) {
      causes.push(error);
    }
  }

  throw new ProvidersUnavailableError(unavailableMessage, causes);
}
