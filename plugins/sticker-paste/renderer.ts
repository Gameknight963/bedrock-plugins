/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export function isActive(): boolean { return Boolean(context && !context.signal.aborted); }
export const patches: SourcePatch[] = [{ id: 'stage-selected-sticker', find: '.STICKER_PICKER:return""', replacement: {
    match: /(?<=\)\{)if\([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\.getUploadCount/,
    replace: 'if($self.isActive())return true;$&'
} }];
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
