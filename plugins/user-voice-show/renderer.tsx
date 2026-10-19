/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { React, setContext, getContext } from './discord.js';
import { VoiceChannelIndicator as Indicator, clearClickTimers } from './components.js';
export const settings = Bedrock.definePluginSettings({
    showInUserProfileModal: { type: Bedrock.OptionType.BOOLEAN, label: 'User profiles', description: 'Show voice indicators next to profile names', default: true },
    showInMemberList: { type: Bedrock.OptionType.BOOLEAN, label: 'Member, DM and friend lists', description: 'Show voice indicators in member, DM and friend lists', default: true },
    showInMessages: { type: Bedrock.OptionType.BOOLEAN, label: 'Messages', description: 'Show voice indicators next to message authors', default: true }
});
const definitions = [
    { id: 'member-voice', find: '.pclUFJ}),children:', replacements: [{ match: /children:\[(?=.{0,300},lostPermissionTooltipText:)/, replace: 'children:[$self.renderMembers(arguments[0]),' }] },
    { id: 'dm-voice', find: 'PrivateChannel.renderAvatar', replacements: [{ match: /(\i\.isSystemDM\(\)\?.{0,100}:null)/, replace: '[$self.renderMembers(arguments[0]),$1]' }] },
    { id: 'message-voice', find: '["AeYyL+"]', replacements: [{ match: /\.AmHag5.+?renderPopout:.+?(?=\])/, replace: '$&,$self.renderMessages(arguments[0])' }] },
    { id: 'profile-voice', find: '.GI2A8C', replacements: [
        { match: /(?<=children:(?:\i|\[\.\.\..+?\])\}\):\i,\(?)null!=\i/, replace: '($&||!!$self.renderNicknameIcons({userId:arguments[0].user?.id})?.length)' },
        { match: /(?<=shouldUnderlineOnHover:null.{0,2000})children:(\i|\[\.\.\..+?\])(?=\}\)\])/, replace: 'children:[...$self.renderNicknameIcons({userId:arguments[0].user?.id}),$1]' }
    ] },
    { id: 'friend-voice', find: 'null!=this.peopleListItemRef.current', replacements: [{ match: /\.isProvisional.{0,50}?className:\i\.\i,children:\[(?<=isFocused:(\i).+?)/, replace: '$&$self.VoiceChannelIndicator({userId:this?.props?.user?.id,isActionButton:true,shouldHighlight:$1}),' }] }
];
export const patches: SourcePatch[] = definitions.map(patch => ({ id: patch.id, find: patch.find, replacement: { match: /^[\s\S]*$/, replace(source: string): string {
    for (const replacement of patch.replacements) {
        const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
        if (!match.test(source)) throw new Error(`User Voice Show could not locate the ${patch.id} insertion point (${replacement.match}).`);
        source = source.replace(match, replacement.replace);
    }
    return source;
} } }));
function VisibleIndicator({ place, ...props }: any): any {
    const options = settings.use(['showInUserProfileModal', 'showInMemberList', 'showInMessages']);
    if (getContext().signal.aborted || !props.userId || place === 'profile' && !options.showInUserProfileModal || place === 'message' && !options.showInMessages || place === 'member' && !options.showInMemberList) return null;
    return React.createElement(Indicator, props);
}
export const VoiceChannelIndicator = (props: any) => React.createElement(VisibleIndicator, { ...props, place: 'member' });
export const renderMembers = (props: any) => props.user ? React.createElement('div', { className: 'vc-member-list-decorators-wrapper' }, React.createElement(VisibleIndicator, { place: 'member', userId: props.user.id })) : null;
export const renderMessages = (props: any) => props.message?.author ? React.createElement('div', { className: 'vc-message-decorations-wrapper' }, React.createElement(VisibleIndicator, { place: 'message', userId: props.message.author.id, isMessage: true })) : null;
export const renderNicknameIcons = (props: any) => props.userId ? [React.createElement(VisibleIndicator, { key: 'voice', place: 'profile', userId: props.userId, isProfile: true })] : [];
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx);
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load voice indicator styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) ctx.styles.add(css);
}
export function stop(): void { clearClickTimers(); }
