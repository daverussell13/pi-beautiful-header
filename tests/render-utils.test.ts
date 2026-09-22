import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectPiCommandNames,
	formatCwd,
	formatModelLabel,
	formatThinkingLabel,
	headerColumnWidths,
	PI_BUILTIN_SLASH_COMMAND_NAMES,
	PI_WORKING_VERBS,
	pickSlashCommandTips,
	pickWorkingVerb,
} from "../extensions/render-utils.ts";

describe("formatCwd", () => {
	it("replaces HOME prefix with ~", () => {
		assert.equal(formatCwd("/Users/me/Workspace/mypi", "/Users/me"), "~/Workspace/mypi");
		assert.equal(formatCwd("/Users/me", "/Users/me"), "~");
		assert.equal(formatCwd("/Users/me/Workspace/mypi", "/Users/me/"), "~/Workspace/mypi");
	});

	it("leaves paths outside home unchanged", () => {
		assert.equal(formatCwd("/tmp/project", "/Users/me"), "/tmp/project");
		assert.equal(formatCwd("/Users/me2/project", "/Users/me"), "/Users/me2/project");
	});

	it("leaves paths unchanged when HOME is missing", () => {
		assert.equal(formatCwd("/Users/me/project", undefined), "/Users/me/project");
	});
});

describe("formatModelLabel", () => {
	it("formats provider/id when both exist", () => {
		assert.equal(formatModelLabel({ provider: "openai-codex", id: "gpt-5.5" }), "openai-codex/gpt-5.5");
	});

	it("falls back to id or default", () => {
		assert.equal(formatModelLabel({ id: "gpt-5.5" }), "gpt-5.5");
		assert.equal(formatModelLabel(undefined), "Default model");
	});
});

describe("formatThinkingLabel", () => {
	it("keeps off explicit", () => {
		assert.equal(formatThinkingLabel("off"), "off");
		assert.equal(formatThinkingLabel("high"), "high");
	});
});

describe("pickWorkingVerb", () => {
	it("picks randomly from a large Pi working verb list", () => {
		assert.ok(PI_WORKING_VERBS.length >= 80);
		assert.equal(pickWorkingVerb(undefined, () => 0), PI_WORKING_VERBS[0]);
		assert.equal(pickWorkingVerb(undefined, () => 0.999), PI_WORKING_VERBS.at(-1));
	});

	it("avoids repeating the previous verb", () => {
		const previous = PI_WORKING_VERBS[0]!;
		assert.notEqual(pickWorkingVerb(previous, () => 0), previous);
	});
});

describe("pickSlashCommandTips", () => {
	it("always leads with fixed commands then random picks", () => {
		const tips = pickSlashCommandTips(["model", "compact", "new", "reload"], {
			fixed: ["use-default-tui"],
			count: 3,
			random: () => 0, // deterministic shuffle direction
		});
		assert.equal(tips[0], "/use-default-tui");
		assert.equal(tips.length, 4);
		assert.ok(tips.every((t) => t.startsWith("/")));
		assert.ok(!tips.includes("/use-claude-code-tui"));
	});

	it("excludes fixed and package self-command from the random pool", () => {
		const tips = pickSlashCommandTips(
			["use-default-tui", "use-claude-code-tui", "model", "compact", "hotkeys"],
			{
				fixed: ["use-default-tui"],
				count: 3,
				random: () => 0,
			},
		);
		assert.equal(tips[0], "/use-default-tui");
		assert.equal(tips.length, 4);
		assert.ok(!tips.includes("/use-claude-code-tui"));
		assert.deepEqual(new Set(tips.slice(1)), new Set(["/model", "/compact", "/hotkeys"]));
	});

	it("handles a small pool without padding", () => {
		const tips = pickSlashCommandTips(["model"], {
			fixed: ["use-default-tui"],
			count: 3,
		});
		assert.deepEqual(tips, ["/use-default-tui", "/model"]);
	});
});

describe("collectPiCommandNames", () => {
	it("merges builtins with session commands", () => {
		const names = collectPiCommandNames([{ name: "use-default-tui" }, { name: "my-cmd" }]);
		assert.ok(names.includes("model"));
		assert.ok(names.includes(PI_BUILTIN_SLASH_COMMAND_NAMES[0]!));
		assert.ok(names.includes("my-cmd"));
		assert.ok(names.includes("use-default-tui"));
	});
});

describe("headerColumnWidths", () => {
	it("keeps both columns readable on wide terminals", () => {
		const layout = headerColumnWidths(100);
		assert.equal(layout.useTips, true);
		assert.ok(layout.leftWidth >= 28);
		assert.ok(layout.rightWidth <= 56);
		assert.equal(layout.leftWidth + layout.rightWidth + 3, 100);
	});

	it("keeps a readable logo half on medium split-pane widths", () => {
		// ~76-col herdr pane → inner ~74
		const layout = headerColumnWidths(74);
		assert.equal(layout.useTips, true);
		assert.ok(layout.leftWidth >= 28, `left should remain readable, got ${layout.leftWidth}`);
		assert.ok(layout.rightWidth <= 56);
	});

	it("uses full inner width when tips cannot fit", () => {
		const layout = headerColumnWidths(40);
		assert.equal(layout.useTips, false);
		assert.equal(layout.leftWidth, 40);
		assert.equal(layout.rightWidth, 0);
	});

	it("enables info when logo + sidebar minimums fit", () => {
		// min left 28 + gap 3 + min info 20 = 51
		const layout = headerColumnWidths(51);
		assert.equal(layout.useTips, true);
		assert.ok(layout.leftWidth >= 28);
		assert.ok(layout.rightWidth >= 20);
	});
});
