/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    hideArrow: { type: Bedrock.OptionType.BOOLEAN, label: 'Hide Arrow', description: 'Hide the role list collapse control.', default: false }
});
const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'expanded-role-list', find: 'hasDeveloperContextMenu:', replacement: [
    { match: new RegExp(String.raw`(?<=\?\i\.current\[\i\].{0,100}?)useState\(!1\)`.replaceAll('\\i', identifier)), replace: 'useState(!0)' },
    { match: new RegExp(String.raw`(?<=useLayoutEffect\(\(\)=>\{if\()\i`.replaceAll('\\i', identifier)), replace: 'false' },
    { match: new RegExp(String.raw`return (\i\.length<\i\.length)`.replaceAll('\\i', identifier)), replace: 'return !$self.settings.store.hideArrow&&($1)' }
] }];
export function start(): void {}
