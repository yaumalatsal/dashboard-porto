"use client";

import type { ReactNode } from "react";
import SmoothScrollProvider from "@/providers/SmoothScrollProvider";
import CustomCursor from "@/components/ui/CustomCursor";
import IntroLoader from "@/components/ui/IntroLoader";
import PageTransition from "@/components/ui/PageTransition";
import SignalLayer from "@/components/ui/SignalLayer";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SmoothScrollProvider>
      <IntroLoader />
      <CustomCursor />
      <SignalLayer />
      <PageTransition>{children}</PageTransition>
    </SmoothScrollProvider>
  );
}
