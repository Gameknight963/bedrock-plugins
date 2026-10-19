/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const patches: SourcePatch[] = [{ id: 'static-typing-dots', find: 'dotCycle', replacement: {
    match: new RegExp(String.raw`focused:([A-Za-z_$][\w$]*)(?:=(?:!0|!1|true|false))?(?=[,}])`, 'g'),
    replace: (_match: string, focused: string) => `_focused:${focused}=false`
} }];
export function start(): void {}
