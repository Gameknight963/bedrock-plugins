/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    defaultLayout: { type: Bedrock.OptionType.SELECT, label: 'Default layout', description: 'Layout used when a forum has no saved preference.', default: 1,
        options: [{ label: 'List', value: 1 }, { label: 'Gallery', value: 2 }] },
    defaultSortOrder: { type: Bedrock.OptionType.SELECT, label: 'Default sort order', description: 'Sort order used when a forum has no saved preference.', default: 0,
        options: [{ label: 'Recently Active', value: 0 }, { label: 'Date Posted', value: 1 }] }
});
export const patches: SourcePatch[] = [{ id: 'forum-defaults', find: 'getDefaultLayout(){', replacement: [
    { match: /}getDefaultLayout\(\){/, replace: '$&return $self.settings.store.defaultLayout;' },
    { match: /}getDefaultSortOrder\(\){/, replace: '$&return $self.settings.store.defaultSortOrder;' }
] }];
export function start(): void {}
