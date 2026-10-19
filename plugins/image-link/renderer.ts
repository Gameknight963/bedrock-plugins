/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'keep-image-link-text', find: '={linkCount:0,onlyLinks:!1};function ', replacement: {
    match: new RegExp(String.raw`\i\.has\(\i\.type\)&&\(0,\i\.\i\)\(\i\)`.replaceAll('\\i', identifier)), replace: 'false'
} }];
export function start(): void {}
