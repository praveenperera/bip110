import {
  readFirstAvailable as readFirstAvailableRescript,
  readWithBackgroundRefresh,
} from "./ProviderFallback.gen.ts";

export { ProvidersUnavailableError } from "./ProviderFallbackError.ts";

/** Successful value returned by one provider in an ordered fallback chain */
export interface ProviderResult<Provider, Value> {
  provider: Provider;
  value: Value;
}

/** Reads a readonly TypeScript provider list through the ReScript implementation */
export function readFirstAvailable<Provider, Value>(
  providers: readonly Provider[],
  read: (provider: Provider) => Promise<Value>,
  unavailableMessage: string,
): Promise<ProviderResult<Provider, Value>> {
  return readFirstAvailableRescript(
    providers as Provider[],
    read,
    unavailableMessage,
  );
}

export { readWithBackgroundRefresh };
