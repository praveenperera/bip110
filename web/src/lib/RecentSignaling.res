@genType
type window =
  | @as(48) Blocks48
  | @as(72) Blocks72
  | @as(144) Blocks144

@genType
type signalingBlock = {
  height: int,
  signaling: bool,
}

@genType
type recent = {
  window: window,
  sampled: int,
  signaling: int,
  pct: float,
  partial: bool,
}

@genType
let recentWindows = [Blocks48, Blocks72, Blocks144]

@genType
let defaultRecentWindow = Blocks48

@genType
let recentWindowParam = "window"

let blockDataUnavailable = "Block data unavailable."

let windowToInt = (window: window) => (window :> int)

@genType
let recentSignaling = (blocks: array<signalingBlock>, window: window): recent => {
  let windowSize = windowToInt(window)
  let newest =
    blocks
    ->Array.toSorted((left, right) => Int.compare(right.height, left.height))
    ->Array.slice(~end=windowSize)
  let signaling = newest->Array.filter(block => block.signaling)->Array.length
  let sampled = newest->Array.length

  {
    window,
    sampled,
    signaling,
    pct: sampled === 0 ? 0.0 : signaling->Int.toFloat /. sampled->Int.toFloat *. 100.0,
    partial: sampled < windowSize,
  }
}

@genType
let parseRecentWindow = value => {
  switch value->Nullable.toOption->Option.flatMap(value => Int.fromString(value)) {
  | Some(72) => Blocks72
  | Some(144) => Blocks144
  | Some(48)
  | None
  | Some(_) =>
    Blocks48
  }
}

@genType
let recentWindowSearch = (search, window) => {
  let params = Browser.makeUrlSearchParams(search)

  switch window {
  | Blocks48 => params->Browser.deleteSearchParam(recentWindowParam)
  | Blocks72
  | Blocks144 =>
    params->Browser.setSearchParam(recentWindowParam, window->windowToInt->Int.toString)
  }

  switch params->Browser.searchParamsToString {
  | "" => ""
  | next => `?${next}`
  }
}

@genType
let recentWindowHeading = window => `Last ${window->windowToInt->Int.toString} blocks`

@genType
let recentWindowDuration = window => {
  switch window {
  | Blocks48 => "roughly the last 8 hours"
  | Blocks72 => "roughly the last 12 hours"
  | Blocks144 => "roughly the last day"
  }
}

@genType
let recentSignalingCounts = recent => {
  if recent.sampled === 0 {
    blockDataUnavailable
  } else {
    `${recent.signaling->Int.toString} of ${recent.sampled->Int.toString} recent blocks signaled for BIP-110`
  }
}

@genType
let recentSignalingDetail = (recent, periodNum) => {
  if recent.sampled === 0 {
    ""
  } else if recent.partial {
    `Only ${recent.sampled->Int.toString} blocks have been mined since period ${periodNum->Int.toString} began, so this window covers ${recent.sampled->Int.toString} blocks.`
  } else {
    `This window covers ${recent.window->recentWindowDuration}.`
  }
}
