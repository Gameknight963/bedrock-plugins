/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
function find(predicate: (value: any) => boolean): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error('A Discord module needed by Voice Chat Double Click has not loaded.');
    return value;
}
const ChannelStore = { getChannel: (id: string) => find(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function').getChannel(id) };
const SelectedChannelStore = { getVoiceChannelId: () => find(value => typeof value?.getVoiceChannelId === 'function').getVoiceChannelId() };
const ChannelRouter = { transitionToChannel: (id: string) => find(value => typeof value?.transitionToChannel === 'function').transitionToChannel(id) };
const timers = {} as Record<string, {
    timeout?: ReturnType<typeof setTimeout>;
    i: number;
}>;

export const plugin = {
    name: "VoiceChatDoubleClick",
    description: "Join voice chats via double click instead of single click",
    patches: [
        // Stage Channels & Voice Channels
        // the find is for stage channels, but it also handles voice
        // channels because they're both in the same concatenated module
        // the find for voice channels was `.handleVoiceStatusClick`
        {
            find: ".handleClickChat",
            // hack: these are not React onClick, it is a custom prop handled by Discord
            // thus, replacing this with onDoubleClick won't work, and you also cannot check
            // e.detail since instead of the event they pass the channel.
            // do this timer workaround instead
            replacement: [
                {
                    match: /onClick:\(\)=>\{this.handleClick\(\)/g,
                    replace: "onClick:()=>{$self.schedule(()=>{this.handleClick()},this)",
                },
            ]
        },
        {
            // channel mentions
            find: 'className:"channelMention",children:[null!=',
            replacement: {
                match: /onClick:(\i)(?=,.{0,30}className:"channelMention".+?(\i)\.inContent)/,
                replace: (_: string, onClick: string, props: string) => ""
                    + `onClick:(vcDoubleClickEvt)=>$self.shouldRunOnClick(vcDoubleClickEvt,${props})&&${onClick}()`,
            }
        },
        // Voice channels in the active now section
        {
            find: ',["embedded_background"]',
            replacement: {
                // There are two onClick events for this section, one for the server icon, and another for the channel name
                // The server icon takes you to the voice channel, but doesnt join it. The channel name joins the voice channel
                match: /(?=children)(?<=selectVoiceChannel\((\i)\.id\).{0,100})/,
                replace: "onClick:$self.goToChannel.bind(null,$1),"
            }
        }
    ],

    goToChannel(props: { id?: string; } | undefined) {
        const { id } = props ?? {};
        if (!id) return console.error("No channel id found");
        ChannelRouter.transitionToChannel(id);
    },

    shouldRunOnClick(e: MouseEvent, { channelId }: { channelId: string }) {
        if (!context || context.signal.aborted) return true;
        const channel = ChannelStore.getChannel(channelId);
        if (!channel || ![2, 13].includes(channel.type)) return true;
        return e.detail >= 2;
    },

    schedule(cb: () => void, e: any) {
        if (!context || context.signal.aborted) { cb(); return; }
        const id = e.props.channel.id as string;
        if (SelectedChannelStore.getVoiceChannelId() === id) {
            cb();
            return;
        }
        // use a different counter for each channel
        const data = (timers[id] ??= { timeout: void 0, i: 0 });
        // clear any existing timer
        clearTimeout(data.timeout);

        // if we already have 2 or more clicks, run the callback immediately
        if (++data.i >= 2) {
            cb();
            delete timers[id];
        } else {
            // else reset the counter in 500ms
            data.timeout = setTimeout(() => {
                delete timers[id];
            }, 500);
        }
    }
};
export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({
    id: `voice-double-click-${index}`, find: patch.find,
    replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
            const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Voice Chat Double Click replacement did not match: ${replacement.match}`);
            const replace = typeof replacement.replace === 'string' ? replacement.replace.replaceAll('$self', '$self.plugin') : (...args: any[]) => (replacement.replace as Function)(...args).replaceAll('$self', '$self.plugin');
            source = source.replace(match, replace as any);
        }
        return source;
    } }
}));
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void {
    for (const [id, data] of Object.entries(timers)) { clearTimeout(data.timeout); delete timers[id]; }
}
