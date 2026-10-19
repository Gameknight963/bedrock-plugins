/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const patches: SourcePatch[] = [
    { id: 'call-idle-timer', find: 'this.idleTimeout.start(', replacement: { match: /this\.idleTimeout\.(start|stop)/g, replace: '$self.noop' } },
    { id: 'idle-afk-move', find: 'handleIdleUpdate(){', replacement: { match: 'handleIdleUpdate(){', replace: 'handleIdleUpdate(){return;' } }
];
export function noop(): void {}
export function start(): void {}
