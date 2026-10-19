/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';
export const settings = Bedrock.definePluginSettings({
    zoomMultiplier: { type: Bedrock.OptionType.SLIDER, label: 'Zoom multiplier', description: 'Maximum zoom in the avatar crop tool', default: 4, min: 2, max: 16, step: 1 }
});
export const patches: SourcePatch[] = [{ id: 'avatar-zoom-limit', find: '.DxAYCF', replacement: {
    match: /maxValue:\d+(?:\.\d+)?/, replace: 'maxValue:$self.settings.store.zoomMultiplier'
} }];
export function start(): void {}
