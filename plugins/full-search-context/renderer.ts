/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch, Disposer } from '@bedrock/renderer';
let context: RendererContext | undefined;
let removeMenuPatch: Disposer | undefined;
export const patches: SourcePatch[] = [{ id: 'full-search-message-menu', find: 'Listbox navigator was given an unhandled action', replacement: {
    match: new RegExp(String.raw`this(?=\.handleContextMenu\(\i,\i\))`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')), replace: '$self'
} }];
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context!.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function byCode(name: string, marker: string): any {
    return find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && String(component).includes(marker); }, name);
}
function translation(hash: string): string {
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    return find(value => typeof value?.string === 'function' && typeof value?.format === 'function', 'localization').string(messages[hash]);
}
function MessageMenu({ message, channel, onHeightUpdate }: any): any {
    const user = find(value => value?.getName?.() === 'UserStore', 'user store').getCurrentUser();
    const useMessageMenu = byCode('message menu', '.MESSAGE,commandTargetId:');
    return useMessageMenu({ navId: 'message-actions', ariaLabel: translation('Lv7LxN'), message, channel,
        canReport: !!message.author && message.author.id !== user?.id && !message.author.system,
        onHeightUpdate, onClose: () => find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus').closeContextMenu(),
        textSelection: '', favoriteableType: null, favoriteableId: null, favoriteableName: null,
        itemHref: undefined, itemSrc: undefined, itemSafeSrc: undefined, itemTextContent: undefined, isFullSearchContextMenu: true });
}
function groupFor(children: any[], id: string): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (Array.isArray(child)) {
            const group = groupFor(child, id);
            if (group) return group;
            continue;
        }
        const nested = child?.props?.children;
        if (!nested) continue;
        const normalized = Array.isArray(nested) ? nested : [context!.react.isValidElement(nested) && nested.key == null ? context!.react.cloneElement(nested, { key: 'original' }) : nested];
        const group = groupFor(normalized, id);
        if (group) {
            if (!Array.isArray(nested)) children[index] = context!.react.cloneElement(child, { children: normalized });
            return group;
        }
    }
    return undefined;
}
export function handleContextMenu(event: MouseEvent, message: any): void {
    if (!context || context.signal.aborted) return;
    const channel = find(value => value?.getName?.() === 'ChannelStore', 'channel store').getChannel(message.channel_id);
    if (!channel) return;
    event.stopPropagation();
    find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus').openContextMenu(event,
        (props: any) => context!.react.createElement(MessageMenu, { message, channel, onHeightUpdate: props.onHeightUpdate, isFullSearchContextMenu: true }));
}
export function start(ctx: RendererContext): void {
    context = ctx;
    removeMenuPatch = ctx.contextMenus.patch('message-actions', (children, props: any) => {
        if (!props?.isFullSearchContextMenu || !props.message?.author?.id) return;
        const CopyId = ctx.webpack.find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && String(component).includes('cannot copy null text'); });
        const group = groupFor(children, 'devmode-copy-id');
        if (CopyId && group) group.push(ctx.react.createElement(CopyId, { key: 'copy-author-id', id: props.message.author.id, label: translation('Muw4wm') }));
    });
}
export function stop(): void { removeMenuPatch?.(); removeMenuPatch = undefined; context = undefined; }
