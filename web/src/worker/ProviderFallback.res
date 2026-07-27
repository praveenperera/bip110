module Error = {
  @module("./ProviderFallbackError.ts") @new
  external make: (string, array<unknown>) => JsError.t = "ProvidersUnavailableError"
}

external exceptionAsUnknown: exn => unknown = "%identity"

type providerResult<'provider, 'value> = {
  provider: 'provider,
  value: 'value,
}

let readFirstAvailable = async (providers, read, unavailableMessage) => {
  let causes = []

  let rec readAt = async index => {
    switch providers->Array.get(index) {
    | None => Error.make(unavailableMessage, causes)->JsError.throw
    | Some(provider) =>
      try {
        let value = await read(provider)
        {provider, value}
      } catch {
      | error =>
        let cause = switch JsExn.fromException(error) {
        | Some(jsException) => jsException
        | None => exceptionAsUnknown(error)
        }
        causes->Array.push(cause)->ignore
        await readAt(index + 1)
      }
    }
  }

  await readAt(0)
}

let readWithBackgroundRefresh = async (readCurrent, refresh, waitUntil) => {
  let current = await readCurrent()
  waitUntil(refresh(current))
  current
}
