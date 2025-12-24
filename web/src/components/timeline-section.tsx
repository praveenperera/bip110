"use client";

import { FadeIn } from "./fade-in";
import { timeline } from "@/lib/content";

export function TimelineSection() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl font-bold text-center mb-4">
            Deployment Timeline
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Key dates and milestones for BIP-110 activation
          </p>
        </FadeIn>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-border md:-translate-x-0.5" />

          <div className="space-y-8">
            {timeline.map((item, i) => (
              <FadeIn key={item.event}>
                <div
                  className={`relative flex items-start gap-6 ${
                    i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  {/* Dot */}
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background -translate-x-1.5 md:-translate-x-2 mt-1.5" />

                  {/* Content */}
                  <div
                    className={`ml-12 md:ml-0 md:w-[calc(50%-2rem)] ${
                      i % 2 === 0 ? "md:pr-8 md:text-right" : "md:pl-8"
                    }`}
                  >
                    <div className="bg-card border border-border/50 rounded-lg p-5">
                      <span className="text-sm text-primary font-medium">
                        {item.date}
                      </span>
                      <h3 className="font-semibold mt-1">{item.event}</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="hidden md:block md:w-[calc(50%-2rem)]" />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <FadeIn delay={0.5}>
          <p className="text-sm text-muted-foreground text-center mt-12">
            Signaling uses bit 4 • Activation requires 55% threshold
            (1109/2016 blocks)
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
