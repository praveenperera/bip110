"use client";

import { ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { FadeIn } from "./fade-in";
import { bipMeta } from "@/lib/content";

export function Footer() {
  return (
    <footer className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <Separator className="mb-8" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              BIP-{bipMeta.number}: {bipMeta.title}
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/dathonohm/bips/blob/reduced-data/bip-0110.mediawiki"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              >
                Full BIP <ExternalLink className="h-3 w-3" />
              </a>
              <span>•</span>
              <span>By {bipMeta.author}</span>
              <span>•</span>
              <span>{bipMeta.license}</span>
            </div>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
