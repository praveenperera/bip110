@genType
type route = [
  | #monitorApi
  | #monitorBlocksApi
  | #monitorPage
  | #monitorOgImage
  | #ursfMonitorPage
  | #assets
]

@genType
type requestMethod = [#get | #head | #unsupported]

@genType let monitorApiPath = "/api/monitor"
@genType let monitorBlocksApiPath = "/api/monitor-blocks"
@genType let monitorOgImagePath = "/og/monitor.png"

let requestMethod = method =>
  switch method {
  | "GET" => #get
  | "HEAD" => #head
  | _ => #unsupported
  }

let route = pathname =>
  if pathname === monitorApiPath {
    #monitorApi
  } else if pathname === monitorBlocksApiPath {
    #monitorBlocksApi
  } else if pathname === "/monitor" || pathname === "/monitor/" {
    #monitorPage
  } else if pathname === monitorOgImagePath {
    #monitorOgImage
  } else if pathname === "/ursf-monitor" || pathname === "/ursf-monitor/" {
    #ursfMonitorPage
  } else {
    #assets
  }
