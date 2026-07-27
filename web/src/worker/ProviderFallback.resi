/** Successful value returned by one provider in an ordered fallback chain */
@genType
type providerResult<'provider, 'value> = {
  provider: 'provider,
  value: 'value,
}

/** Reads providers in priority order and returns the first successful value */
@genType
let readFirstAvailable: (
  array<'provider>,
  'provider => promise<'value>,
  string,
) => promise<providerResult<'provider, 'value>>

/** Returns a current value without awaiting its scheduled background refresh */
@genType
let readWithBackgroundRefresh: (
  unit => promise<'value>,
  'value => promise<unit>,
  promise<unit> => unit,
) => promise<'value>
