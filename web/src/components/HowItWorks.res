@react.component
let make = () =>
  <section id="how" className="py-24 px-6">
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4"> {React.string("How It Works")} </h2>
      <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
        {React.string(
          "Simple restrictions that preserve all monetary use cases while limiting data abuse",
        )}
      </p>
      <div className="space-y-4">
        {Content.specifications
        ->Array.map((specification: Content.specification) =>
          <Ui.Card key={specification.title} className="border-border/50">
            <Ui.CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-3"> {React.string(specification.title)} </h3>
              <p className="text-muted-foreground mb-4"> {React.string(specification.simple)} </p>
              <Ui.Accordion>
                <Ui.AccordionItem value="details" className="border-none">
                  <Ui.AccordionTrigger className="text-sm text-primary hover:no-underline py-2">
                    {React.string("Technical Details")}
                  </Ui.AccordionTrigger>
                  <Ui.AccordionContent
                    className="text-sm text-muted-foreground font-mono bg-muted/50 p-3 rounded-lg"
                  >
                    {React.string(specification.technical)}
                  </Ui.AccordionContent>
                </Ui.AccordionItem>
              </Ui.Accordion>
            </Ui.CardContent>
          </Ui.Card>
        )
        ->React.array}
      </div>
      <p className="text-sm text-muted-foreground text-center mt-8">
        {React.string(
          "Inputs spending UTXOs created before activation are permanently exempt from these rules — there is no deadline to move existing funds.",
        )}
      </p>
      <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {React.string("Inspect the implementation")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {React.string(
                "The commented walkthrough ties each rule to the tagged Bitcoin Knots source.",
              )}
            </p>
          </div>
          <a
            href="/code-walkthrough"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-primary/30 bg-background px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            {React.string("Open code walkthrough")}
          </a>
        </div>
      </div>
    </div>
  </section>
