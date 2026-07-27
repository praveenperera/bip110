/** Worker request destinations with all application-owned routes explicit */
@genType
type route = [
  | #monitorApi
  | #monitorBlocksApi
  | #monitorPage
  | #monitorOgImage
  | #ursfMonitorPage
  | #assets
]

/** Read-method policy shared by application-owned Worker routes */
@genType
type requestMethod = [#get | #head | #unsupported]

/** Canonical monitor JSON endpoint */
@genType
let monitorApiPath: string

/** Canonical monitor-block JSON endpoint */
@genType
let monitorBlocksApiPath: string

/** Canonical dynamic monitor social-image endpoint */
@genType
let monitorOgImagePath: string

/** Classifies one HTTP method for an application-owned route */
@genType
let requestMethod: string => requestMethod

/** Selects the application handler for one URL pathname */
@genType
let route: string => route
