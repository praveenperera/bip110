"use client";

import { Clock, Shield, CheckCircle, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "./fade-in";
import { keyPoints } from "@/lib/content";

const iconMap = {
  clock: Clock,
  shield: Shield,
  check: CheckCircle,
  target: Target,
};

export function KeyPointsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl font-bold text-center mb-4">Key Points</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            A temporary, focused intervention to protect Bitcoin&apos;s core
            mission
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {keyPoints.map((point, i) => {
            const Icon = iconMap[point.icon as keyof typeof iconMap];
            return (
              <FadeIn key={point.title} delay={i * 0.1}>
                <Card className="h-full border-border/50 bg-card/50 backdrop-blur hover:border-primary/30 transition-colors">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{point.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {point.description}
                    </p>
                  </CardContent>
                </Card>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
