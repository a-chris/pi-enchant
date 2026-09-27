/**
 * Custom Compaction Extension
 *
 * Compacts context using a configurable summarizer model instead of the
 * session model. The model is read from the existing pi settings files:
 *
 *   ~/.pi/agent/settings.json  ->  { "compaction": { "summarizerModel": "provider/model-id" } }
 *   .pi/settings.json          ->  same key, overrides the user-level setting
 *                                  (only read when the project is trusted)
 *
 * Falls back to pi's built-in compaction when:
 *   - the setting is unset
 *   - the configured model cannot be found in the registry
 *   - the summary comes back empty
 *   - the summarization call fails
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, getAgentDir, serializeConversation } from "@earendil-works/pi-coding-agent";

const SUMMARIZER_PROMPT = `You are a conversation summarizer. Create a comprehensive summary of this coding session that captures:

1. The main goals and objectives discussed
2. Key decisions made and their rationale
3. Important code changes, file modifications, or technical details
4. Current state of any ongoing work
5. Any blockers, issues, or open questions
6. Next steps that were planned or suggested

Be thorough but concise. The summary will replace older conversation history, so include all information needed to continue the work effectively.

Format the summary as structured markdown with clear sections.

<conversation>
{{conversation}}
</conversation>`;

async function readSettings(file: string): Promise<any> {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return undefined;
	}
}

/** Resolve "provider/model-id" from project settings (if trusted), else user settings. */
async function resolveSummarizerModelKey(cwd: string, projectTrusted: boolean): Promise<string | undefined> {
	if (projectTrusted) {
		const project = await readSettings(path.join(cwd, ".pi", "settings.json"));
		const value: unknown = project?.compaction?.summarizerModel;
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	const user = await readSettings(path.join(getAgentDir(), "settings.json"));
	const value: unknown = user?.compaction?.summarizerModel;
	if (typeof value === "string" && value.trim()) return value.trim();
	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		const { preparation, signal } = event;

		const modelKey = await resolveSummarizerModelKey(ctx.cwd, ctx.isProjectTrusted());
		if (!modelKey) return; // not configured -> default compaction

		// Provider is everything before the first "/", model ID is the rest
		// (model IDs may themselves contain slashes, e.g. openrouter/openai/gpt-4.1-nano).
		const slash = modelKey.indexOf("/");
		if (slash <= 0 || slash === modelKey.length - 1) {
			ctx.ui.notify(`compaction.summarizerModel "${modelKey}" is not a valid provider/model-id, using default compaction`, "warning");
			return;
		}
		const provider = modelKey.slice(0, slash);
		const modelId = modelKey.slice(slash + 1);

		const model = ctx.modelRegistry.find(provider, modelId);
		if (!model) {
			ctx.ui.notify(`compaction.summarizerModel "${modelKey}" not found in model registry, using default compaction`, "warning");
			return;
		}

		const messagesToSummarize = [...preparation.messagesToSummarize, ...(preparation.turnPrefixMessages ?? [])];
		const conversationText = serializeConversation(convertToLlm(messagesToSummarize));

		try {
			const response = await ctx.modelRegistry.complete(
				model,
				{
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: SUMMARIZER_PROMPT.replace("{{conversation}}", conversationText),
								},
							],
						},
					],
				},
				{
					maxTokens: 8192,
					signal,
					cacheRetention: "none",
					sessionId: uuidv7(),
				},
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				if (!signal.aborted) ctx.ui.notify("Custom compaction produced an empty summary, using default compaction", "warning");
				return;
			}

			return {
				compaction: {
					summary,
					firstKeptEntryId: preparation.firstKeptEntryId,
					tokensBefore: preparation.tokensBefore,
					usage: response.usage,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!signal.aborted) ctx.ui.notify(`Custom compaction failed: ${message}. Using default compaction.`, "error");
			return;
		}
	});
}
