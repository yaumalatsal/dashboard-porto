"use client";

import type { ReactNode } from "react";
import SmoothScrollProvider from "@/providers/SmoothScrollProvider";
import AstrolabeScene from "@/components/ui/AstrolabeScene";
import CustomCursor from "@/components/ui/CustomCursor";
import IntroLoader from "@/components/ui/IntroLoader";
import PageTransition from "@/components/ui/PageTransition";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <IntroLoader />
      <CustomCursor />
      <AstrolabeScene />
      <PageTransition>{children}</PageTransition>
    </SmoothScrollProvider>
  );
}
