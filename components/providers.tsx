"use client";

import React from "react";
import ErrorBoundary from "@/components/error-boundary";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default Providers;
