import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqItems } from "@/lib/content";

export function FAQ() {
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    const syncHash = () => {
      const questionId = window.location.hash.slice(1);
      if (questionId && faqItems.some((_, i) => `q${i + 1}` === questionId)) {
        setOpenItems([questionId]);
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  const handleQuestionClick = (questionId: string) => {
    const url = new URL(window.location.href);
    url.hash = questionId;
    window.history.replaceState({}, "", url);
  };

  return (
    <section id="faq" className="py-24 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Common Questions
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Answers to frequently asked questions about BIP-110
        </p>

        <Accordion
          className="space-y-4"
          value={openItems}
          onValueChange={(value) =>
            setOpenItems(
              value.filter((item): item is string => typeof item === "string"),
            )
          }
        >
          {faqItems.map((item, i) => {
            const questionId = `q${i + 1}`;

            return (
              <AccordionItem
                key={questionId}
                id={questionId}
                value={questionId}
                className="scroll-mt-24 bg-card border border-border/50 rounded-lg px-6 data-[open]:border-primary/30"
              >
                <AccordionTrigger
                  className="text-left font-medium hover:no-underline py-5"
                  onClick={() => handleQuestionClick(questionId)}
                >
                  <span className="pr-1">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
