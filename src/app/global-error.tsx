"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#0b0b0c",
          color: "#f5f5f5",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            The application failed to load
          </h1>
          <p style={{ fontSize: 14, color: "#a3a3a3", marginBottom: 16 }}>
            Something went badly wrong. Your data is safe — please try again.
          </p>
          {error?.message && (
            <p
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "#8a8a8a",
                background: "#1a1a1c",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 20,
                wordBreak: "break-all",
              }}
            >
              {error.message}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              background: "#f5f5f5",
              color: "#0b0b0c",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
