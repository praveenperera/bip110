let highlightPlaceholders = [0, 1, 2]

let statusClass = hasLag =>
  hasLag
    ? "border-border/60 bg-background/70 text-xs border-primary/30 bg-primary/10 text-primary"
    : "border-border/60 bg-background/70 text-xs"

@react.component
let make = (
  ~cacheInfo: Nullable.t<MonitorDataController.cacheInfo>,
  ~data: Nullable.t<Monitor.monitorData>,
  ~error: Nullable.t<string>,
  ~loading,
) => {
  let data = data->Nullable.toOption
  let stats = data->Option.map(MonitorDashboardModel.highlightStats)
  let lagStatus =
    data->Option.flatMap(data => MonitorDashboardModel.monitorLagStatus(data)->Nullable.toOption)
  let transientStatus = switch data {
  | Some(_) => None
  | None => Some(loading ? "Loading live status" : "Monitor unavailable")
  }
  let status = lagStatus->Option.orElse(transientStatus)

  <section className="px-6 py-24" dataTestId="monitor-react">
    <div className="mx-auto max-w-5xl">
      <h2 className="mb-4 text-center text-3xl font-bold">
        {React.string("Live BIP-110 signaling")}
      </h2>
      <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
        {React.string(
          "Track current miner support, period progress, and the remaining signals needed for activation.",
        )}
      </p>
      <Ui.Card className="border-border/50 bg-card/70 shadow-sm shadow-foreground/5 backdrop-blur">
        <Ui.CardContent className="pt-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {switch status {
                | Some(status) =>
                  <Ui.Badge variant="outline" className={statusClass(lagStatus->Option.isSome)}>
                    {React.string(status)}
                  </Ui.Badge>
                | None => React.null
                }}
                {switch cacheInfo->Nullable.toOption {
                | Some(cacheInfo) =>
                  <span className="text-xs text-muted-foreground">
                    {React.string(
                      `Updated ${MonitorDashboardModel.formatCacheAge(
                          cacheInfo.cachedAt,
                          Date.now(),
                        )}`,
                    )}
                  </span>
                | None => React.null
                }}
              </div>
              {switch (error->Nullable.toOption, data) {
              | (Some(error), None) =>
                <p className="mt-2 text-sm text-destructive"> {React.string(error)} </p>
              | _ => React.null
              }}
            </div>
            <a
              href="/monitor"
              className={`${Ui.buttonVariants({
                  variant: "outline",
                  size: "sm",
                })} w-fit bg-background`}
            >
              {React.string("Full monitor")}
              <span ariaHidden=true>
                <Ui.ExternalLink className="size-3.5" />
              </span>
            </a>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {switch stats {
            | Some(stats) =>
              stats
              ->Array.map(stat =>
                <div
                  key={stat.label} className="rounded-lg border border-border/50 bg-muted/30 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {React.string(stat.label)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {React.string(stat.value)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {React.string(stat.detail)}
                  </p>
                </div>
              )
              ->React.array
            | None =>
              highlightPlaceholders
              ->Array.map(index =>
                <div
                  key={index->Int.toString}
                  className="rounded-lg border border-border/50 bg-muted/30 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {React.string("Loading")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {React.string("N/A")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {React.string("Waiting for monitor data")}
                  </p>
                </div>
              )
              ->React.array
            }}
          </div>
        </Ui.CardContent>
      </Ui.Card>
    </div>
  </section>
}
