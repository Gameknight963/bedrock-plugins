/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function store(name: string): any {
    return new Proxy({}, { get(_target, key) {
        const target = find(value => value?.getName?.() === name, name), value = target[key];
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
export const ChannelMemberStore = store('ChannelMemberStore'), ChannelStore = store('ChannelStore');
export const GuildMemberCountStore = store('GuildMemberCountStore'), PermissionStore = store('PermissionStore');
export const SelectedChannelStore = store('SelectedChannelStore'), ThreadMemberListStore = store('ThreadMemberListStore');
export const VoiceStateStore = store('VoiceStateStore');
export const PermissionsBits = { VIEW_CHANNEL: 1024n };
export const getCurrentChannel = () => ChannelStore.getChannel(SelectedChannelStore.getChannelId());
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
export function Tooltip(props: any): any {
    return React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
}
export function useStateFromStores(stores: any[], getValue: () => any, _dependencies?: any[], _compare?: any): any {
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        update();
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
const queued = new Map<string, number>();
let generation = 0;
let queue = Promise.resolve();
export const OnlineMemberCountStore = {
    getCount(guildId: string) { return counts.get(guildId); },
    addChangeListener(callback: () => void) { listeners.add(callback); },
    removeChangeListener(callback: () => void) { listeners.delete(callback); },
    ensureCount(guildId: string) {
        if (!guildId || counts.has(guildId) || queued.has(guildId)) return;
        const activation = context;
        const requestGeneration = generation;
        queued.set(guildId, requestGeneration);
        queue = queue.then(async () => {
            try {
                if (context !== activation || activation.signal.aborted || requestGeneration !== generation || counts.has(guildId)) return;
                const channel = find(value => value?.getName?.() === 'GuildChannelStore', 'guild channels').getDefaultChannel(guildId);
                if (channel) await find(value => value?.preload && value?.openPrivateChannel, 'channel actions').preload(guildId, channel.id);
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) { if (!activation.signal.aborted) activation.log.error('Could not fetch the online member count.', error); }
            finally { if (queued.get(guildId) === requestGeneration) queued.delete(guildId); }
        });
    }
};
export function subscribeCounts(): () => void {
    counts.clear(); queued.clear(); queue = Promise.resolve(); generation++;
    const dispatcher = find(value => value?.dispatch && value?.subscribe && value?.wait, 'dispatcher');
    const update = (event: any) => {
        const count = event.count ?? event.groups?.reduce((sum: number, group: any) => sum + (group.id === 'offline' ? 0 : group.count), 0);
        if (!event.guildId || !Number.isFinite(count)) return;
        counts.set(event.guildId, count);
        for (const listener of listeners) listener();
    };
    const clear = () => {
        counts.clear(); queued.clear(); queue = Promise.resolve(); generation++;
        for (const listener of listeners) listener();
    };
    dispatcher.subscribe('GUILD_MEMBER_LIST_UPDATE', update);
    dispatcher.subscribe('ONLINE_GUILD_MEMBER_COUNT_UPDATE', update);
    dispatcher.subscribe('LOGOUT', clear);
    return () => {
        dispatcher.unsubscribe('GUILD_MEMBER_LIST_UPDATE', update);
        dispatcher.unsubscribe('ONLINE_GUILD_MEMBER_COUNT_UPDATE', update);
        dispatcher.unsubscribe('LOGOUT', clear);
        counts.clear(); queued.clear(); queue = Promise.resolve(); generation++;
    };
}
