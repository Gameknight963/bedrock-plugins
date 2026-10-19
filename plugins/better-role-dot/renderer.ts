/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
const { definePluginSettings, OptionType } = Bedrock;
let context: RendererContext | undefined;
export const settings = definePluginSettings({
    bothStyles: { type: OptionType.BOOLEAN, label: 'Colored names and role dots', description: 'Show both role dots and colored names', default: false, restartNeeded: true },
    copyRoleColorInProfilePopout: { type: OptionType.BOOLEAN, label: 'Profile role dots', description: 'Show clickable role dots in profile popouts', default: false, restartNeeded: true }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
function conditional(id: string, find: string, match: RegExp, enabled: () => boolean): SourcePatch {
    return { id, find, all: true, replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        if (!enabled()) return source;
        const expression = new RegExp(match.source.replaceAll('\\i', identifier), match.flags);
        return source.replace(expression, 'true');
    } } };
}
export const patches: SourcePatch[] = [
    { id: 'copy-role-color', find: 'M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z', replacement: {
        match: /,viewBox:"0 0 20 20"/, replace: "$&,onClick:()=>$self.copyToClipBoard(arguments[0].color),style:{cursor:'pointer'}"
    } },
    conditional('colored-names', '"dot"===', /"(?:username|dot)"===\i(?!\.\i)/g, () => settings.store.bothStyles),
    conditional('profile-role-dot', '.ljnBlo', /"dot"===\i/, () => settings.store.copyRoleColorInProfilePopout && !settings.store.bothStyles),
    conditional('verified-role-dot', '.roleVerifiedIcon', /"dot"===\i/, () => settings.store.copyRoleColorInProfilePopout && !settings.store.bothStyles)
];
export async function copyToClipBoard(color: string): Promise<void> {
    const activation = context;
    if (!activation || activation.signal.aborted || typeof color !== 'string') return;
    try {
        await navigator.clipboard.writeText(color);
        if (!activation.signal.aborted) activation.notifications.show({ title: 'Role color copied', body: color, timeout: 2500 });
    } catch (error) { activation.log.error('Could not copy the role color.', error); }
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
