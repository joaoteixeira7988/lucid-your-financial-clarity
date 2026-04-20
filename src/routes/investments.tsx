import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy route — Investments is now part of /portfolio.
export const Route = createFileRoute("/investments")({
  beforeLoad: () => {
    throw redirect({ to: "/portfolio" });
  },
});
