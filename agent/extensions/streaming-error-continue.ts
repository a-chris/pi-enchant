/**
 * Auto-Continue After Streaming Error
 *
 * Detects "Error: Streaming response failed" in conversation messages.
 * When found, waits 30 seconds then sends "continue" to let the model
 * recover from a dropped stream.
 *
 * Installation: place at ~/.pi/agent/extensions/streaming-error-continue.ts
 * (global — applies to all sessions). Reload with /reload to activate.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STREAMING_ERROR = "Error: Streaming response failed";
const AUTO_DELAY_MS = 30_000;

export default function (pi: ExtensionAPI) {
  // Guard against re-triggering within the same agent run.
  let triggeredForRun = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  pi.on("agent_start", async () => {
    triggeredForRun = false;
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (triggeredForRun) return;
    triggeredForRun = true;

    // Walk the session branch looking for the error string.
    const entries = ctx.sessionManager.getBranch();
    let found = false;

    for (const entry of entries) {
      if (entry.type !== "message") continue;

      if (entry.message.role === "assistant") {
        const text = entry.message.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("\n");

        if (text.includes(STREAMING_ERROR)) {
          found = true;
          break;
        }
      }

      if (entry.message.role === "toolResult" && entry.message.details) {
        const stderr = (entry.message.details as Record<string, unknown>).stderr as
          | string
          | undefined;
        if (stderr?.includes(STREAMING_ERROR)) {
          found = true;
          break;
        }
      }

      if (entry.type === "custom" && entry.data) {
        const dataStr =
          typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data);
        if (dataStr.includes(STREAMING_ERROR)) {
          found = true;
          break;
        }
      }
    }

    if (!found) return;

    if (ctx.hasUI) {
      ctx.ui.notify(
        `⚠️ Streaming response error detected — sending "continue" in ${AUTO_DELAY_MS / 1000}s`,
        "warning",
      );
    }

    pendingTimer = setTimeout(async () => {
      pendingTimer = null;

      if (ctx.hasUI) {
        ctx.ui.notify("✅ Sent: \"continue\"", "info");
      }

      // Queue "continue" so the model retries/recovers from the error.
      try {
        pi.sendUserMessage("continue");
      } catch {
        // Best-effort — ignore if session-switched or already settled.
      }
    }, AUTO_DELAY_MS);
  });

  // Clear pending timer on shutdown to avoid stray sends.
  pi.on("session_shutdown", () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  });
}
