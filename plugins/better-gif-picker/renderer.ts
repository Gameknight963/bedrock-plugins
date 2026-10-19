/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export function initialCategory(): 'Favorites' | null { return context && !context.signal.aborted ? 'Favorites' : null; }
export const patches: SourcePatch[] = [{ id: 'favorite-gifs', find: 'renderHeaderContent(){', replacement: {
    match: /(?<=state={resultType:)null/, replace: '$self.initialCategory()'
} }];
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
