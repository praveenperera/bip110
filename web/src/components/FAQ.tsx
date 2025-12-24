import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { faqItems } from '@/lib/content';

export function FAQ() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Common Questions
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Answers to frequently asked questions about BIP-110
        </p>

        <Accordion type="single" collapsible className="space-y-4">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border border-border/50 rounded-lg px-6 data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left font-medium hover:no-underline py-5">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
