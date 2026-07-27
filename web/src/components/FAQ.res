@module("../lib/content")
external faqItems: array<FaqAnchors.faqItem> = "faqItems"

let anchoredItems = faqItems->FaqAnchors.make

@react.component
let make = () => {
  let (openItems, setOpenItems) = React.useState(() => [])

  React.useEffect0(() => {
    let syncHash = () => {
      let hash = Browser.getLocationHash()

      switch FaqAnchors.resolveHash(anchoredItems, hash)->Nullable.toOption {
      | None => ()
      | Some(item) =>
        setOpenItems(_ => [item.canonicalId])

        if FaqAnchors.decodeHash(hash) !== item.canonicalId {
          Browser.replaceLocationHash(item.canonicalId)
        }
      }
    }

    syncHash()
    let unsubscribe = Browser.watchHashChange(syncHash)
    Some(unsubscribe)
  })

  <section id="faq" className="py-24 px-6 bg-muted/30">
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4"> {React.string("Common Questions")} </h2>
      <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
        {React.string("Answers to frequently asked questions about BIP-110")}
      </p>
      <Ui.Accordion
        className="space-y-4" value={openItems} onValueChange={items => setOpenItems(_ => items)}
      >
        {anchoredItems
        ->Array.map(item =>
          <React.Fragment key={item.legacyId}>
            <div id={item.legacyId} className="block scroll-mt-24" ariaHidden=true />
            <Ui.AccordionItem
              id={item.canonicalId}
              value={item.canonicalId}
              className="scroll-mt-24 bg-card border border-border/50 rounded-lg px-6 data-[open]:border-primary/30"
            >
              <Ui.AccordionTrigger
                className="text-left font-medium hover:no-underline py-5"
                onClick={() => Browser.replaceLocationHash(item.canonicalId)}
              >
                <span className="pr-1"> {React.string(item.question)} </span>
              </Ui.AccordionTrigger>
              <Ui.AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {React.string(item.answer)}
              </Ui.AccordionContent>
            </Ui.AccordionItem>
          </React.Fragment>
        )
        ->React.array}
      </Ui.Accordion>
    </div>
  </section>
}
