import { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, className }: FadeInProps) {
  return <div className={className}>{children}</div>;
}
