/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { React, setContext, subscribeCounts } from './discord.js';
import { MemberCount } from './MemberCount.js';
let context: RendererContext | undefined;
let unsubscribe: (() => void) | undefined;
export const settings = Bedrock.definePluginSettings({
    toolTip: { type: Bedrock.OptionType.BOOLEAN, label: 'Server tooltips', description: 'Show member counts in server tooltips', default: true, restartNeeded: true },
    memberList: { type: Bedrock.OptionType.BOOLEAN, label: 'Member list', description: 'Show member counts above the member list', default: true, restartNeeded: true },
    voiceActivity: { type: Bedrock.OptionType.BOOLEAN, label: 'Voice activity', description: 'Include the number of members in visible voice channels', default: true }
});
const formatter = new Intl.NumberFormat();
export const numberFormat = (value: number) => formatter.format(value);
export const cl = (...values: (string | Record<string, unknown>)[]) => values.flatMap(value => typeof value === 'string' ? [value] : Object.keys(value).filter(key => value[key])).map(value => 'vc-membercount-' + value).join(' ');
const definitions = [
    { id: 'member-list', find: '{isSidebarVisible:', enabled: () => settings.store.memberList, match: /children:\[(\i\.useMemo[^}]+"aria-multiselectable")(?<=className:(\i),.+?)/, replace: "children:[$2?.includes('members')?$self.render():null,$1" },
    { id: 'server-tooltip', find: 'GuildTooltip - ', enabled: () => settings.store.toolTip, match: /\["5LwN89"\].{0,100}(?=])/, replace: '$&,$self.renderTooltip(arguments[0].guild)' }
];
export const patches: SourcePatch[] = definitions.map(patch => ({ id: patch.id, find: patch.find, replacement: { match: /^[\s\S]*$/, replace(source: string): string {
    if (!patch.enabled()) return source;
    const match = new RegExp(patch.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), patch.match.flags);
    if (!match.test(source)) throw new Error(`Member Count could not locate the ${patch.id} insertion point.`);
    return source.replace(match, patch.replace);
} } }));
let Boundary: any;
function widget(props: any): any {
    if (!context || context.signal.aborted) return null;
    const activation = context;
    Boundary ||= class extends (activation.react as any).Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { activation.log.error('Could not display member counts.', error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, null, React.createElement(MemberCount, props));
}
export const render = () => widget({});
export const renderTooltip = (guild: { id: string }) => widget({ isTooltip: true, tooltipGuildId: guild.id });
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx; setContext(ctx);
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load member count styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (ctx.signal.aborted) return;
    ctx.styles.add(css);
    await ctx.webpack.waitFor(value => value?.dispatch && value?.subscribe && value?.wait);
    if (!ctx.signal.aborted && context === ctx) unsubscribe = subscribeCounts();
}
export function stop(): void { unsubscribe?.(); unsubscribe = undefined; context = undefined; }
