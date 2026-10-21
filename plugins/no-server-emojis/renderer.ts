/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

interface Channel { getGuildId(): string | null }
interface Emoji { type: number; guildId?: string }
let context: RendererContext;

export const settings = Bedrock.definePluginSettings({
    shownEmojis: {
        label: 'Autocomplete emojis',
        type: Bedrock.OptionType.SELECT,
        default: 'onlyUnicode',
        options: [
            { label: 'Only Unicode emojis', value: 'onlyUnicode' },
            { label: 'Unicode emojis and current-server emojis', value: 'currentServer' },
            { label: 'Unicode emojis and all server emojis', value: 'all' }
        ]
    }
});

export const patches: SourcePatch[] = [{ id: 'autocomplete-emoji-filter', find: '}searchWithoutFetchingLatest(', replacement: {
    match: new RegExp(String.raw`\.nameMatchesChain\(\i\)\.reduce\(\((\i),(\i)\)=>\{(?<=channel:(\i).+?)`.replaceAll('\\i', '[A-Za-z_$][\\w$]*')),
    replace: '$&if($self.shouldSkip($3,$2))return $1;'
} }];

export function shouldSkip(channel: Channel | null | undefined, emoji: Emoji): boolean {
    if (!context || context.signal.aborted || emoji.type !== 1) return false;
    switch (settings.store.shownEmojis) {
        case 'onlyUnicode': return true;
        case 'currentServer': return emoji.guildId !== (channel?.getGuildId() ?? null);
        default: return false;
    }
}

export function start(ctx: RendererContext): void { context = ctx; }
