import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Home — redirects to "/" which App.tsx handles based on auth state.
 * This page is intentionally minimal; routing logic lives in App.tsx.
 */
export default function Home() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/");
  }, [navigate]);
  return null;
}
