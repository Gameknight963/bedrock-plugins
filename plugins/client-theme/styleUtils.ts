/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
import { hexToHSL } from './colorUtils.js';

interface Activation {
    ctx: RendererContext;
    variables: HTMLStyleElement;
    overrides: HTMLStyleElement;
}
let activation: Activation | undefined;

export function createOrUpdateThemeColorVars(color: string): void {
    if (!activation || activation.ctx.signal.aborted) return;
    const { hue, saturation, lightness } = hexToHSL(color);
    activation.variables.textContent = `:root {
        --theme-h: ${hue};
        --theme-s: ${saturation}%;
        --theme-l: ${lightness}%;
    }`;
}

export async function startClientTheme(ctx: RendererContext, color: string): Promise<void> {
    disableClientTheme();
    const current = { ctx, variables: document.createElement('style'), overrides: document.createElement('style') };
    current.variables.id = 'bedrock-client-theme-vars';
    current.overrides.id = 'bedrock-client-theme-overrides';
    activation = current;
    document.head.append(current.variables, current.overrides);
    createOrUpdateThemeColorVars(color);
    try {
        const styles = await Promise.all(Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), async node => {
            if (!node.href) return '';
            const response = await fetch(node.href, { signal: ctx.signal });
            if (!response.ok) throw new Error(`Could not read Discord's stylesheet ${node.href} (HTTP ${response.status}).`);
            return response.text();
        }));
        if (ctx.signal.aborted || activation !== current) return;
        const lightness: Record<string, number> = {};
        for (const [, name, value] of styles.join('\n').matchAll(/(--neutral-\d{1,3}?-hsl):.+?([\d.]+?)%;/g)) lightness[name] = parseFloat(value);
        const lightBase = lightness['--neutral-2-hsl'], darkBase = lightness['--neutral-69-hsl'];
        if (!Number.isFinite(lightBase) || !Number.isFinite(darkBase)) throw new Error("Discord's stylesheets do not contain the neutral-2 and neutral-69 base colors required by Client Theme.");
        current.overrides.textContent = [
            `.theme-light {\n ${generateNewColorVars(lightness, lightBase)} \n}`,
            `.theme-dark {\n ${generateNewColorVars(lightness, darkBase)} \n}`
        ].join('\n\n');
    } catch (error) {
        if (activation === current) disableClientTheme();
        throw error;
    } finally {
        if (ctx.signal.aborted || activation !== current) { current.variables.remove(); current.overrides.remove(); }
    }
}

function generateNewColorVars(colors: Record<string, number>, base: number): string {
    return Object.entries(colors).map(([name, lightness]) => {
        const offset = lightness - base;
        return `${name}: var(--theme-h) var(--theme-s) calc(var(--theme-l) ${offset >= 0 ? '+' : '-'} ${Math.abs(offset).toFixed(2)}%);`;
    }).join('\n');
}

export function disableClientTheme(): void {
    activation?.variables.remove();
    activation?.overrides.remove();
    activation = undefined;
}
