/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch, Disposer } from '@bedrock/renderer';
import { React, setContext, setCreateScroller, closeModals } from './discord.js';
import { openGuildInfoModal } from './GuildInfoModal.js';
export { setCreateScroller, openGuildInfoModal };
export const settings = Bedrock.definePluginSettings({
    sorting: { type: Bedrock.OptionType.SELECT, label: 'Sort users', description: 'How to sort users in server info tabs', default: 'displayname', options: [
        { label: 'Username', value: 'username' }, { label: 'Display name', value: 'displayname' }, { label: 'Do not sort', value: 'none' }
    ] }
});
export const patches: SourcePatch[] = [{ id: 'native-scroller-factory', find: '="ltr",orientation:', replacement: {
    match: new RegExp(String.raw`(?=function (\i)\(\i,\i,\i\)\{.{0,20}?return function\(\i\)\{let\{[^}]+?="ltr",orientation:)`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: '$self.setCreateScroller($1);'
} }];
let disposers: Disposer[] = [];
function InfoIcon(): any { return React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'currentColor' }, React.createElement('path', { fillRule: 'evenodd', clipRule: 'evenodd', d: 'M23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Zm-9.5-4.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-.77 3.96a1 1 0 1 0-1.96-.42l-1.04 4.86a2.77 2.77 0 0 0 4.31 2.83l.24-.17a1 1 0 1 0-1.16-1.62l-.24.17a.77.77 0 0 1-1.2-.79l1.05-4.86Z' })); }
function findGroup(children: any[], id: string): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (Array.isArray(child)) { const result = findGroup(child, id); if (result) return result; continue; }
        const nested = child?.props?.children;
        if (nested == null) continue;
        const normalized = Array.isArray(nested) ? nested : [React.isValidElement(nested) && nested.key == null ? React.cloneElement(nested, { key: 'original' }) : nested];
        const result = findGroup(normalized, id);
        if (result) {
            if (!Array.isArray(nested)) children[index] = React.cloneElement(child, { children: normalized });
            return result;
        }
    }
    return undefined;
}
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx);
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load server info styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (ctx.signal.aborted) return;
    ctx.styles.add(css);
    for (const id of ['guild-context', 'guild-header-popout']) disposers.push(ctx.contextMenus.patch(id, (children, props: any) => {
        if (!props.guild) return;
        const item = ctx.contextMenus.item({ id: 'bedrock-server-info', label: 'Server Info', leadingAccessory: id === 'guild-header-popout' ? { type: 'icon', icon: InfoIcon } : undefined, action: () => openGuildInfoModal(props.guild) });
        const group = findGroup(children, 'privacy');
        (group || children).push(item);
    }));
}
export function stop(): void { for (const dispose of disposers.splice(0)) dispose(); closeModals(); }
