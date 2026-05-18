import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/auth/AuthGate";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B0B0F" },
      { name: "description", content: "Lucid is an AI-powered finance app. Just talk — Lucid logs your expenses, tracks investments, and shows your real net worth in seconds." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lucid" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Lucid — Your financial autopilot" },
      { property: "og:title", content: "Lucid — Your financial autopilot" },
      { name: "twitter:title", content: "Lucid — Your financial autopilot" },
      { property: "og:description", content: "Lucid is an AI-powered finance app. Just talk — Lucid logs your expenses, tracks investments, and shows your real net worth in seconds." },
      { name: "twitter:description", content: "Lucid is an AI-powered finance app. Just talk — Lucid logs your expenses, tracks investments, and shows your real net worth in seconds." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bb165e29-024b-49bd-a2b1-eb439db9eed3" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/bb165e29-024b-49bd-a2b1-eb439db9eed3" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Lucid",
              url: "https://lucidfinance.dev",
              description:
                "Lucid is an AI-powered personal finance app that logs expenses, tracks investments, and shows real net worth in seconds.",
            },
            {
              "@type": "WebSite",
              name: "Lucid",
              url: "https://lucidfinance.dev",
              description:
                "AI-powered personal finance: talk to Lucid to log spending, track investments, and see your real net worth.",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGate>
        <Outlet />
      </AuthGate>
      <Toaster position="top-center" />
    </AuthProvider>
  );
}
