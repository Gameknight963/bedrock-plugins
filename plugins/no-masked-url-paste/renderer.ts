/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'plain-url-paste', find: '.selection,preventEmojiSurrogates:', replacement: {
    match: new RegExp(String.raw`if\(null!=\i.selection&&\i.\i.isExpanded\(\i.selection\)\)`.replaceAll('\\i', identifier)),
    replace: 'if(false)'
} }];
export function start(): void {}
