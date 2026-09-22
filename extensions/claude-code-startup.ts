import { VERSION, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
	center,
	collectPiCommandNames,
	headerColumnWidths,
	padRight,
	pickSlashCommandTips,
	pickWorkingVerb,
} from "./render-utils.ts";

const LOGO_CELL = "███";
const LOGO_ANIMATION_INTERVAL_MS = 120;
const WORKING_VERB_INTERVAL_MS = 2400;

type LogoColor = "panel" | "cyan" | "red" | "green" | "orange" | "white" | "flash" | "brand";
type LogoFrame = {
	phase: number;
	active: "left" | "top" | "right" | "none";
	ax: number;
	ay: number;
	flash: boolean;
	white: boolean;
};

const LOGO_FRAMES: LogoFrame[] = [
	...Array.from({ length: 4 }, (_, ay) => ({ phase: 0, active: "left" as const, ax: 2, ay, flash: false, white: false })),
	...Array.from({ length: 3 }, (_, ay) => ({ phase: 1, active: "top" as const, ax: 2, ay, flash: false, white: false })),
	...Array.from({ length: 5 }, (_, ay) => ({ phase: 2, active: "right" as const, ax: 5, ay, flash: false, white: false })),
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: true, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 3, active: "none", ax: 0, ay: 0, flash: true, white: false },
	{ phase: 4, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: true },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: false },
	{ phase: 5, active: "none", ax: 0, ay: 0, flash: false, white: true },
	{ phase: 6, active: "none", ax: 0, ay: 0, flash: false, white: false },
];

const colorCell = (color: LogoColor, paintBrand: (text: string) => string): string => {
	switch (color) {
		case "cyan":
			return `\x1b[36m${LOGO_CELL}\x1b[39m`;
		case "red":
			return `\x1b[31m${LOGO_CELL}\x1b[39m`;
		case "green":
			return `\x1b[32m${LOGO_CELL}\x1b[39m`;
		case "orange":
		case "flash":
			return `\x1b[33m${LOGO_CELL}\x1b[39m`;
		case "white":
			return `\x1b[39m${LOGO_CELL}`;
		case "brand":
			return paintBrand(LOGO_CELL);
		default:
			return " ".repeat(LOGO_CELL.length);
	}
};

function hasCell(y: number, x: number, cells: string): boolean {
	return cells.split(" ").includes(`${y},${x}`);
}

function hasPiece(y: number, x: number, py: number, px: number, cells: string): boolean {
	return cells.split(" ").some((item) => {
		const [dy, dx] = item.split(",").map(Number);
		return y === py + dy && x === px + dx;
	});
}

function logoCellColor(frame: LogoFrame, y: number, x: number): LogoColor {
	if (frame.white) {
		return hasCell(y, x, "3,2 3,3 3,4 4,2 4,4 5,2 5,3 5,5 6,2 6,5") ? "white" : "panel";
	}
	if (frame.flash && y === 6 && x >= 1 && x <= 6) return "flash";

	switch (frame.active) {
		case "left":
			if (hasPiece(y, x, frame.ay, frame.ax, "0,0 1,0 1,1 2,0")) return "red";
			break;
		case "top":
			if (hasPiece(y, x, frame.ay, frame.ax, "0,0 0,1 0,2 1,2")) return "cyan";
			break;
		case "right":
			if (hasPiece(y, x, frame.ay, frame.ax, "0,0 1,0 2,0 2,1")) return "green";
			break;
	}

	if (frame.phase === 6) {
		return hasCell(y, x, "3,2 3,3 3,4 4,4 4,2 5,2 5,3 5,5 6,2 6,5") ? "brand" : "panel";
	}

	if (frame.phase === 4) {
		if (hasCell(y, x, "2,2 2,3 2,4 3,4")) return "cyan";
		if (hasCell(y, x, "3,2 4,2 4,3 5,2")) return "red";
		if (hasCell(y, x, "4,5 5,5")) return "green";
		return "panel";
	}

	if (frame.phase >= 5) {
		if (hasCell(y, x, "3,2 3,3 3,4 4,4")) return "cyan";
		if (hasCell(y, x, "4,2 5,2 5,3 6,2")) return "red";
		if (hasCell(y, x, "5,5 6,5")) return "green";
		return "panel";
	}

	if (frame.phase <= 3 && hasCell(y, x, "6,1 6,2 6,3 6,4")) return "orange";
	if (frame.phase >= 2 && hasCell(y, x, "2,2 2,3 2,4 3,4")) return "cyan";
	if (frame.phase >= 1 && hasCell(y, x, "3,2 4,2 4,3 5,2")) return "red";
	if (frame.phase >= 3 && hasCell(y, x, "4,5 5,5 6,5 6,6")) return "green";
	return "panel";
}

function piLogoFrame(frameIndex: number, paintBrand: (text: string) => string): string[] {
	const frame = LOGO_FRAMES[frameIndex % LOGO_FRAMES.length]!;
	// Crop the installer's 9-row canvas vertically for a compact header, then
	// tight-crop empty columns so the mark centers cleanly in the logo half
	// (same idea as Claude Code's centered mascot).
	const grid: LogoColor[][] = [];
	for (let y = 1; y <= 7; y++) {
		const row: LogoColor[] = [];
		for (let x = 1; x <= 8; x++) row.push(logoCellColor(frame, y, x));
		grid.push(row);
	}

	let minX = 7;
	let maxX = 0;
	for (const row of grid) {
		row.forEach((cell, x) => {
			if (cell !== "panel") {
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
			}
		});
	}
	if (maxX < minX) {
		minX = 0;
		maxX = 7;
	}

	return grid.map((row) => {
		let line = "";
		for (let x = minX; x <= maxX; x++) line += colorCell(row[x]!, paintBrand);
		return line;
	});
}

function borderLine(
	left: string,
	label: string,
	right: string,
	width: number,
	paint: (text: string) => string,
): string {
	if (width <= 1) return "";
	if (width < 8 || label.length === 0) {
		return paint(truncateToWidth(left + "─".repeat(Math.max(0, width - 2)) + right, width, ""));
	}

	const before = "─── ";
	const after = " ─────";
	const fixedWidth = visibleWidth(before) + visibleWidth(label) + visibleWidth(after);
	const fill = Math.max(0, width - 2 - fixedWidth);
	return `${paint(left)}${paint(before)}${label}${paint(after)}${paint("─".repeat(fill))}${paint(right)}`;
}

function boxedLine(content: string, width: number, paint: (text: string) => string): string {
	if (width <= 2) return truncateToWidth(content, width, "");
	return `${paint("│")}${padRight(content, width - 2)}${paint("│")}`;
}

function twoColumn(
	left: string,
	right: string,
	leftWidth: number,
	rightWidth: number,
	paint: (text: string) => string,
): string {
	// Tips sidebar truncates with an ellipsis (Claude Code style); logo half does not.
	return `${padRight(left, leftWidth)} ${paint("│")} ${padRight(right, rightWidth, "…")}`;
}

class PiStartupHeader implements Component {
	private frame = 0;
	private readonly timer?: NodeJS.Timeout;
	/** Cached once so logo animation frames don't reshuffle tip commands. */
	private readonly tipCommands: string[];

	constructor(
		private readonly pi: ExtensionAPI,
		private readonly ctx: ExtensionContext,
		private readonly tui: TUI,
		animateLogo = true,
	) {
		const pool = collectPiCommandNames(this.pi.getCommands());
		this.tipCommands = pickSlashCommandTips(pool, {
			fixed: ["use-default-tui"],
			count: 3,
		});

		if (!animateLogo) {
			this.frame = LOGO_FRAMES.length - 1;
			return;
		}

		this.timer = setInterval(() => {
			if (this.frame < LOGO_FRAMES.length - 1) {
				this.frame++;
				this.tui.requestRender();
			} else if (this.timer) {
				clearInterval(this.timer);
			}
		}, LOGO_ANIMATION_INTERVAL_MS);
		this.timer.unref?.();
	}

	render(width: number): string[] {
		const theme = this.ctx.ui.theme;
		const paint = (s: string) => theme.fg("accent", s);
		const muted = (s: string) => theme.fg("muted", s);
		const highlight = (s: string) => theme.fg("mdLink", s);
		const bold = (s: string) => theme.bold(s);

		if (width < 24) return [paint("Pi")];

		const innerWidth = width - 2;
		const { leftWidth, rightWidth, useTips } = headerColumnWidths(innerWidth);
		const leftLines = [
			...piLogoFrame(this.frame, paint).map((line) => center(line, leftWidth)),
			"",
			center(bold(highlight("Pi Coding Agent")), leftWidth),
			center(muted(`v${VERSION}`), leftWidth),
			"",
			center(paint("There are many agent harnesses,"), leftWidth),
			center(`${paint("but this one is ")}${bold(highlight("yours"))}${paint(".")}`, leftWidth),
		];

		// /use-default-tui + 3 random real pi commands (picked once in constructor).
		const tipDivider = paint("─".repeat(Math.max(8, Math.min(rightWidth, 22))));
		const [cmd0 = "", cmd1 = "", cmd2 = "", cmd3 = ""] = this.tipCommands;
		const tipLines = [
			"",
			paint(bold("Getting started")),
			muted("Ask Pi to build it"),
			tipDivider,
			paint(bold("Commands")),
			muted(cmd0),
			muted(cmd1),
			muted(cmd2),
			muted(cmd3),
			"",
		];

		const lines = [borderLine("╭", "", "╮", width, paint)];
		const bodyLineCount = useTips ? Math.max(leftLines.length, tipLines.length) : leftLines.length;
		for (let i = 0; i < bodyLineCount; i++) {
			const content = useTips
				? twoColumn(leftLines[i] ?? "", tipLines[i] ?? "", leftWidth, rightWidth, paint)
				: padRight(leftLines[i] ?? "", leftWidth);
			lines.push(boxedLine(content, width, paint));
		}
		lines.push(borderLine("╰", "", "╯", width, paint));
		return lines.map((line) => truncateToWidth(line, width, ""));
	}

	invalidate(): void {}

	dispose(): void {
		if (this.timer) clearInterval(this.timer);
	}
}

let activePiStartupHeader: PiStartupHeader | undefined;
let workingVerbTimer: NodeJS.Timeout | undefined;
let workingVerbContext: ExtensionContext | undefined;

function stopWorkingVerbs(ctx?: ExtensionContext): void {
	if (workingVerbTimer) {
		clearInterval(workingVerbTimer);
		workingVerbTimer = undefined;
	}

	const activeContext = workingVerbContext ?? ctx;
	workingVerbContext = undefined;
	if (activeContext?.mode === "tui") activeContext.ui.setWorkingMessage(undefined);
}

function startWorkingVerbs(ctx: ExtensionContext): void {
	if (ctx.mode !== "tui") return;

	stopWorkingVerbs(ctx);
	workingVerbContext = ctx;
	let previous: string | undefined;
	const update = () => {
		const verb = pickWorkingVerb(previous);
		previous = verb;
		ctx.ui.setWorkingMessage(`${verb}...`);
	};

	update();
	workingVerbTimer = setInterval(update, WORKING_VERB_INTERVAL_MS);
	workingVerbTimer.unref?.();
}

function disposeActiveHeader(): void {
	activePiStartupHeader?.dispose();
	activePiStartupHeader = undefined;
}

function applyPiLook(pi: ExtensionAPI, ctx: ExtensionContext, animateLogo = true): void {
	if (ctx.mode !== "tui") return;

	ctx.ui.setTitle("Pi");
	ctx.ui.setHeader((tui) => {
		disposeActiveHeader();
		activePiStartupHeader = new PiStartupHeader(pi, ctx, tui, animateLogo);
		return activePiStartupHeader;
	});
	ctx.ui.setFooter(undefined); // keep pi's original footer
	ctx.ui.setWorkingIndicator(undefined); // keep pi's original spinner
}

function shouldAnimateStartupLogo(
	event: { reason?: string; previousSessionFile?: string },
	ctx: ExtensionContext,
): boolean {
	if (process.env.PI_BEAUTIFUL_HEADER_NO_ANIMATION === "1") return false;
	if (event.previousSessionFile) return false;
	if (event.reason === "resume" || event.reason === "reload" || event.reason === "fork") return false;
	return ctx.sessionManager.getBranch().length === 0 && ctx.sessionManager.getEntries().length === 0;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (event, ctx) => {
		const applyAfterOtherStartupHandlers = setTimeout(() => {
			const animateLogo = shouldAnimateStartupLogo(event, ctx);
			applyPiLook(pi, ctx, animateLogo);
		}, 0);
		applyAfterOtherStartupHandlers.unref?.();
	});

	pi.on("agent_start", (_event, ctx) => {
		startWorkingVerbs(ctx);
	});

	pi.on("agent_end", (_event, ctx) => {
		stopWorkingVerbs(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		stopWorkingVerbs(ctx);
		disposeActiveHeader();
	});

	// Named after the package (pi-claude-code-tui), not the host app.
	pi.registerCommand("use-claude-code-tui", {
		description: "Switch to the pi-claude-code-tui look (Pi header)",
		handler: async (_args, ctx) => {
			applyPiLook(pi, ctx, process.env.PI_BEAUTIFUL_HEADER_NO_ANIMATION !== "1");
			ctx.ui.notify("Using pi-claude-code-tui", "info");
		},
	});

	pi.registerCommand("use-default-tui", {
		description: "Switch back to pi's built-in header, footer, and spinner",
		handler: async (_args, ctx) => {
			stopWorkingVerbs(ctx);
			disposeActiveHeader();
			ctx.ui.setTitle("pi");
			ctx.ui.setHeader(undefined);
			ctx.ui.setFooter(undefined);
			ctx.ui.setWorkingIndicator(undefined);
			ctx.ui.notify("Using default pi TUI", "info");
		},
	});
}
