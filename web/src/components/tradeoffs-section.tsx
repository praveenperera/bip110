"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FadeIn } from "./fade-in";
import { tradeoffs } from "@/lib/content";

const severityColors = {
  low: "border-l-green-500",
  medium: "border-l-yellow-500",
  high: "border-l-red-500",
};

export function TradeoffsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl font-bold text-center mb-4">
            {tradeoffs.headline}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Honest assessment of limitations and risks
          </p>
        </FadeIn>

        <div className="space-y-4 mb-12">
          {tradeoffs.items.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1}>
              <Card
                className={`border-l-4 ${severityColors[item.severity as keyof typeof severityColors]}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Info className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4}>
          <Alert className="border-primary/30 bg-primary/5">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <AlertTitle className="text-lg">
              {tradeoffs.safety.headline}
            </AlertTitle>
            <AlertDescription className="mt-2 text-muted-foreground">
              {tradeoffs.safety.content}
            </AlertDescription>
          </Alert>
        </FadeIn>
      </div>
    </section>
  );
}
