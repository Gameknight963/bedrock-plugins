/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export function isActive(): boolean { return Boolean(context && !context.signal.aborted); }
export const patches: SourcePatch[] = [{ id: 'stage-selected-gif', find: 'handleSelectGIF=', replacement: {
    match: /handleSelectGIF=\(([A-Za-z_$][\w$]*),[A-Za-z_$][\w$]*\)=>\{/,
    replace: '$&if($self.isActive()&&!this?.props?.className)return $self.handleSelect($1);'
} }];
export function handleSelect(gif?: { url: string }): void {
    const ctx = context;
    if (!gif || !ctx || ctx.signal.aborted) return;
    try {
        if (typeof gif.url !== 'string' || !gif.url.trim()) throw new Error(`Invalid GIF URL: ${JSON.stringify(gif.url)}. Expected a nonempty string.`);
        const dispatch = ctx.webpack.find<{ dispatchToLastSubscribed(event: string, data: object): void }>(value => typeof value?.dispatchToLastSubscribed === 'function');
        const picker = ctx.webpack.find<{ closeExpressionPicker(): void }>(value => typeof value?.closeExpressionPicker === 'function');
        if (!dispatch) throw new Error("Discord's chat input dispatcher is unavailable.");
        if (!picker) throw new Error("Discord's expression picker is unavailable.");
        const text = `${gif.url} `;
        dispatch.dispatchToLastSubscribed('INSERT_TEXT', { rawText: text, plainText: text });
        picker.closeExpressionPicker();
    } catch (error) {
        ctx.log.error(error);
        ctx.notifications.show({ title: 'Could not insert GIF', body: error instanceof Error ? error.message : String(error), type: 'error' });
    }
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
