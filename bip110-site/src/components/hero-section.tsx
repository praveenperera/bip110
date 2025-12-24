"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "./fade-in";
import { ThemeToggle } from "./theme-toggle";
import { bipMeta, abstract } from "@/lib/content";

export function HeroSection() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      {/* Theme toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <FadeIn>
          <Badge variant="outline" className="mb-6 text-sm px-4 py-1.5">
            {bipMeta.status} • {bipMeta.layer}
          </Badge>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="text-primary">BIP-{bipMeta.number}:</span>
            <br />
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Protecting Bitcoin&apos;s Purpose
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {abstract}
          </p>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-8">
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a
                href="https://github.com/dathonohm/bips/blob/reduced-data/bip-0110.mediawiki"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the Full BIP
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span>By {bipMeta.author}</span>
            <span className="hidden sm:inline">•</span>
            <span>Created {bipMeta.created}</span>
            <span className="hidden sm:inline">•</span>
            <span>{bipMeta.license}</span>
          </div>
        </FadeIn>

        {/* Scroll indicator */}
        <FadeIn delay={0.5}>
          <div className="mt-16 animate-bounce">
            <svg
              className="w-6 h-6 mx-auto text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
