import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { specifications } from '@/lib/content';

export function HowItWorks() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Simple restrictions that preserve all monetary use cases while
          limiting data abuse
        </p>

        <div className="space-y-4">
          {specifications.map((spec) => (
            <Card key={spec.title} className="border-border/50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">{spec.title}</h3>
                <p className="text-muted-foreground mb-4">{spec.simple}</p>

                <Accordion type="single" collapsible>
                  <AccordionItem value="technical" className="border-none">
                    <AccordionTrigger className="text-sm text-primary hover:no-underline py-2">
                      Technical Details
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground font-mono bg-muted/50 p-3 rounded-lg">
                      {spec.technical}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center mt-8">
          Inputs spending UTXOs created before activation are exempt from
          these rules.
        </p>
      </div>
    </section>
  );
}
