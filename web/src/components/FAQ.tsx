import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqItems } from "@/lib/content";

type FaqItemWithAnchors = (typeof faqItems)[number] & {
  canonicalId: string;
  legacyId: string;
};

function slugifyQuestion(question: string) {
  return question
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createFaqItemsWithAnchors(): FaqItemWithAnchors[] {
  const slugCounts = new Map<string, number>();

  return faqItems.map((item, index) => {
    const baseSlug = slugifyQuestion(item.question) || `question-${index + 1}`;
    const slugCount = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, slugCount);

    return {
      ...item,
      canonicalId: slugCount === 1 ? baseSlug : `${baseSlug}-${slugCount}`,
      legacyId: `q${index + 1}`,
    };
  });
}

const faqItemsWithAnchors = createFaqItemsWithAnchors();

function decodeHash(hash: string) {
  const questionId = hash.startsWith("#") ? hash.slice(1) : hash;

  try {
    return decodeURIComponent(questionId);
  } catch {
    return questionId;
  }
}

function resolveFaqItem(hash: string) {
  const questionId = decodeHash(hash);

  if (!questionId) {
    return null;
  }

  return (
    faqItemsWithAnchors.find(
      (item) => item.canonicalId === questionId || item.legacyId === questionId,
    ) ?? null
  );
}

export function FAQ() {
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  React.useEffect(() => {
    const syncHash = () => {
      const item = resolveFaqItem(window.location.hash);

      if (!item) {
        return;
      }

      setOpenItems([item.canonicalId]);

      if (decodeHash(window.location.hash) !== item.canonicalId) {
        const url = new URL(window.location.href);
        url.hash = item.canonicalId;
        window.history.replaceState({}, "", url);
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
          {faqItemsWithAnchors.map((item) => {
            return (
              <React.Fragment key={item.legacyId}>
                <div
                  id={item.legacyId}
                  className="block scroll-mt-24"
                  aria-hidden="true"
                />
                <AccordionItem
                  id={item.canonicalId}
                  value={item.canonicalId}
                  className="scroll-mt-24 bg-card border border-border/50 rounded-lg px-6 data-[open]:border-primary/30"
                >
                  <AccordionTrigger
                    className="text-left font-medium hover:no-underline py-5"
                    onClick={() => handleQuestionClick(item.canonicalId)}
                  >
                    <span className="pr-1">{item.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </React.Fragment>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
