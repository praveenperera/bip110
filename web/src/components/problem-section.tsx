"use client";

import { FadeIn } from "./fade-in";
import { motivation } from "@/lib/content";

export function ProblemSection() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl font-bold text-center mb-12">
            {motivation.headline}
          </h2>
        </FadeIn>

        <div className="space-y-8">
          {motivation.paragraphs.map((paragraph, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4}>
          <div className="mt-12 p-6 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-center font-medium text-lg">
              &ldquo;Bitcoin should do one thing, and do it well.&rdquo;
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
