/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export const settings = Bedrock.definePluginSettings({
    displayStyle: { type: Bedrock.OptionType.SELECT, label: 'Display style', description: 'Where to show the remaining timeout duration', default: 'inline', options: [
        { label: 'In the tooltip', value: 'tooltip' }, { label: 'Beside the timeout icon', value: 'inline' }
    ] }
});
export const patches: SourcePatch[] = [{ id: 'timeout-duration', find: '["AeYyL+"]', replacement: {
    match: new RegExp(String.raw`\i\.\i,{(text:.{0,30}\["AeYyL\+"\]\))`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: '$self.TooltipWrapper,{message:arguments[0].message,$1'
} }];
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context?.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
export function TimeoutContent({ message, children, text }: any): any {
    const ctx = context!;
    const { displayStyle } = settings.use(['displayStyle']);
    const channel = find(value => value?.getName?.() === 'ChannelStore', 'channel store').getChannel(message.channel_id);
    const members = find(value => value?.getName?.() === 'GuildMemberStore', 'guild member store');
    const [, refresh] = ctx.react.useState(0);
    ctx.react.useEffect(() => {
        const update = () => refresh(value => value + 1);
        members.addChangeListener(update);
        return () => members.removeChangeListener(update);
    }, [members]);
    const member = channel?.guild_id && members.getMember(channel.guild_id, message.author.id);
    const Tooltip = find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip');
    if (!member?.communicationDisabledUntil) return ctx.react.createElement(Tooltip, { text, children });
    const CountDown = find(value => typeof value === 'function' && value.prototype?.render && String(value.prototype.render).includes('.PqEzn8'), 'countdown');
    const countdown = () => ctx.react.createElement(CountDown, { deadline: new Date(member.communicationDisabledUntil), showUnits: true, stopAtOneSec: true });
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    const intl = find(value => typeof value?.string === 'function' && typeof value?.format === 'function', 'localization');
    const tooltip = intl.format(messages['t+abNU'], { username: message.author.username, countdown });
    return ctx.react.createElement(Tooltip, { text: tooltip, children: (props: any) => displayStyle === 'tooltip'
        ? ctx.react.createElement('span', props, typeof children === 'function' ? children(props) : children)
        : ctx.react.createElement('div', { ...props, className: 'vc-std-wrapper' }, typeof children === 'function' ? children(props) : children,
            ctx.react.createElement('span', { style: { fontFamily: 'var(--font-primary)', fontSize: '16px', lineHeight: '20px', fontWeight: 400, margin: 0, color: 'var(--text-feedback-critical)' } }, countdown(), ' timeout remaining')) });
}
let Boundary: any;
export function TooltipWrapper(props: any): any {
    if (!context || context.signal.aborted) return typeof props.children === 'function' ? props.children({}) : props.children;
    const ctx = context;
    Boundary ||= class extends (ctx.react as any).Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { ctx.log.error('Could not display the timeout duration.', error); }
        render() { return this.state.failed ? this.props.fallback : this.props.children; }
    };
    return ctx.react.createElement(Boundary, { fallback: typeof props.children === 'function' ? props.children({}) : props.children }, ctx.react.createElement(TimeoutContent, props));
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add('.vc-std-wrapper{display:flex;align-items:center;width:max-content;max-width:100%}.vc-std-wrapper [class*="communicationDisabled"]{margin-right:0}');
}
export function stop(): void { context = undefined; }
