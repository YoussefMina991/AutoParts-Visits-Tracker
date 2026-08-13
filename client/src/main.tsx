import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

// When running as a native Android APK, we need the full server URL.
// When running in a browser (dev or web), we use the relative path.
const BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.1.8:3000";
const API_URL = Capacitor.isNativePlatform()
  ? `${BASE_URL}/api/trpc`
  : "/api/trpc";

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: API_URL,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");
createRoot(rootEl).render(<Root />);
