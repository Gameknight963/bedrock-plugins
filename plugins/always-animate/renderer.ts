/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    icons: { type: Bedrock.OptionType.BOOLEAN, label: 'Icons and avatars', description: 'Always animate server icons, avatars and decorations.', default: true, restartNeeded: true },
    statusEmojis: { type: Bedrock.OptionType.BOOLEAN, label: 'Status emoji', description: 'Always animate custom status emoji.', default: true, restartNeeded: true },
    serverBanners: { type: Bedrock.OptionType.BOOLEAN, label: 'Server banners', description: 'Always animate server banners.', default: true, restartNeeded: true },
    nameplates: { type: Bedrock.OptionType.BOOLEAN, label: 'Nameplates', description: 'Keep profile nameplate animations looping.', default: true, restartNeeded: true },
    roleGradients: { type: Bedrock.OptionType.BOOLEAN, label: 'Role gradients', description: 'Always animate gradient role colors.', default: true, restartNeeded: true }
});

const identifier = '[A-Za-z_$][\\w$]*';
function patch(id: string, find: string, key: keyof typeof settings.store, match: RegExp, replace: string | ((...values: any[]) => string), all = false): SourcePatch {
    return { id, find, all, replacement: { match: /^[\s\S]*$/, replace(source: string) {
        if (!settings.store[key]) return source;
        match.lastIndex = 0;
        if (!match.test(source) && !all) throw new Error(`Discord's ${id} animation control did not match.`);
        match.lastIndex = 0;
        return source.replace(match, replace as string);
    } } };
}

export const patches: SourcePatch[] = [
    patch('animated-icons', 'canAnimate:', 'icons', /canAnimate:.+?([,}].*?\))/g, (match: string, rest: string) =>
        /}=.+/.test(rest) ? match : `canAnimate:!0${rest}`, true),
    patch('status-emoji', 'pclUFJ),children:', 'statusEmojis', new RegExp(String.raw`(\.CUSTOM_STATUS.+?animateEmoji:)\i`.replaceAll('\\i', identifier)), '$1!0'),
    patch('server-banner', 'O8lDI2', 'serverBanners', new RegExp(String.raw`(guildBanner:\i,animate:)\i(?=}\):null)`.replaceAll('\\i', identifier)), '$1!0'),
    patch('chat-role-gradient', '=!1,contentOnly:', 'roleGradients', new RegExp(String.raw`animate:\i`.replaceAll('\\i', identifier)), 'animate:!0'),
    patch('member-role-gradient', '="left",className:', 'roleGradients', /,animateGradient:/, ',animateGradient:!0,_oldAnimateGradient:'),
    patch('nameplate-loop', '.MINI_PREVIEW,[', 'nameplates', new RegExp(String.raw`animate:\i,loop:`.replaceAll('\\i', identifier)), 'animate:true,loop:true,_loop:'),
    patch('role-gradients', 'animateGradient:', 'roleGradients', /animateGradient:.+?([,}].*?\))/g, (match: string, rest: string) =>
        /}=.+/.test(rest) ? match : `animateGradient:!0${rest}`, true)
];

export function start(): void {}
