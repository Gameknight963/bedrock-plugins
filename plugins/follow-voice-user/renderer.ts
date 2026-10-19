/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
export const settings = Bedrock.definePluginSettings({
    onlyWhenInVoice: { type: Bedrock.OptionType.BOOLEAN, label: 'Only while connected', description: 'Only follow the user while you are in a voice channel.', default: true },
    leaveWhenUserLeaves: { type: Bedrock.OptionType.BOOLEAN, label: 'Leave with the user', description: 'Leave voice when the user leaves. Following each other with this enabled can cause repeated joins and disconnects.', default: false }
});
type VoiceState = { userId: string; channelId?: string | null };
type Dispatcher = { dispatch(event: unknown): void; subscribe(event: string, callback: (event: { voiceStates: VoiceState[] }) => void): void; unsubscribe(event: string, callback: (event: { voiceStates: VoiceState[] }) => void): void };
let context: RendererContext;
let followed: { userId: string; lastChannelId?: string | null } | undefined;
let dispatcher: Dispatcher | undefined;
let removeMenu: (() => void) | undefined;
function find<T = any>(predicate: (value: any) => boolean): T {
    const value = context.webpack.find<T>(predicate);
    if (!value) throw new Error('A Discord module needed by Follow Voice User has not loaded.');
    return value;
}
function currentUser(): { id: string } | undefined { return find(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function').getCurrentUser(); }
function friends(): string[] { return find(value => typeof value?.getFriendIDs === 'function').getFriendIDs(); }
function FollowItem({ userId }: { userId: string }): unknown {
    const [checked, setChecked] = context.react.useState(followed?.userId === userId);
    return context.react.createElement(find(value => value?.MenuCheckboxItem && value?.MenuItem).MenuCheckboxItem, {
        id: 'fvu-follow-user', label: 'Follow User', checked,
        action: () => {
            if (context.signal.aborted) return;
            if (followed?.userId === userId) { followed = undefined; setChecked(false); }
            else { followed = { userId }; setChecked(true); }
        }
    });
}
function voiceUpdated({ voiceStates }: { voiceStates: VoiceState[] }): void {
    if (context.signal.aborted || !followed || !friends().includes(followed.userId)) return;
    const userId = currentUser()?.id;
    if (!userId) return;
    const voices = find(value => typeof value?.getVoiceStateForUser === 'function');
    if (settings.store.onlyWhenInVoice && !voices.getVoiceStateForUser(userId)?.channelId) return;
    const state = voiceStates.find(state => state.userId === followed?.userId);
    if (!state) return;
    const actions = find(value => typeof value?.selectVoiceChannel === 'function');
    if (state.channelId && state.channelId !== followed.lastChannelId) {
        followed.lastChannelId = state.channelId;
        actions.selectVoiceChannel(state.channelId);
    } else if (!state.channelId && settings.store.leaveWhenUserLeaves) actions.selectVoiceChannel(null);
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx; followed = undefined;
    const events = await ctx.webpack.waitFor<Dispatcher>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    if (ctx.signal.aborted) return;
    dispatcher = events;
    events.subscribe('VOICE_STATE_UPDATES', voiceUpdated);
    removeMenu = ctx.contextMenus.patch<{ user?: { id: string } }>('user-context', (children, { user }) => {
        if (!user || ctx.signal.aborted || user.id === currentUser()?.id || !friends().includes(user.id)) return;
        const menu = find(value => value?.MenuSeparator && value?.MenuItem);
        children.push(ctx.react.createElement(menu.MenuSeparator, null), ctx.react.createElement(FollowItem, { userId: user.id }));
    });
}
export function stop(): void {
    dispatcher?.unsubscribe('VOICE_STATE_UPDATES', voiceUpdated);
    dispatcher = undefined; removeMenu?.(); removeMenu = undefined; followed = undefined;
}
