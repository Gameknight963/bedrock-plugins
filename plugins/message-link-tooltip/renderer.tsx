/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
let Boundary: any;
let nativeReact: RendererContext['react'] | undefined;
const pending = new Map<string, Promise<any>>();
const React = { createElement(type: any, props: any, ...children: any[]): any { return nativeReact?.createElement(type, props, ...children); } };
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
export const settings = Bedrock.definePluginSettings({
    onLink: { label: 'Message links', description: 'Preview messages when hovering over message links.', type: Bedrock.OptionType.BOOLEAN, default: true },
    onReply: { label: 'Replies', description: 'Preview messages when hovering over replies.', type: Bedrock.OptionType.BOOLEAN, default: true },
    onForward: { label: 'Forwarded messages', description: 'Preview original messages when hovering over forwards.', type: Bedrock.OptionType.BOOLEAN, default: true },
    display: { label: 'Message layout', type: Bedrock.OptionType.SELECT, default: 'auto', options: [{ label: 'Same as message', value: 'auto' }, { label: 'Compact', value: 'compact' }, { label: 'Cozy', value: 'cozy' }] }
});
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context?.webpack.find(predicate);
    if (!value) throw new Error(`Message Link Tooltip could not find Discord's ${name}.`);
    return value;
}
function store(name: string): any { return find(value => value?.getName?.() === name, name); }
export async function loadMessage(channelId: string, messageId: string): Promise<any> {
    const activation = context;
    if (!activation || activation.signal.aborted) return;
    if (!/^\d+$/.test(channelId) || !/^\d+$/.test(messageId)) throw new Error(`Invalid message reference: channel ${JSON.stringify(channelId)}, message ${JSON.stringify(messageId)}.`);
    const messages = store('MessageStore');
    const cached = messages.getMessage(channelId, messageId);
    if (cached) return cached;
    const key = `${channelId}/${messageId}`, existing = pending.get(key);
    if (existing) return existing;
    const rest = find(value => value?.get && value?.del && value?.put, 'HTTP client');
    const task = (async () => {
        let response: any;
        try { response = await rest.get({ url: `/channels/${channelId}/messages`, query: { limit: 1, around: messageId }, retries: 2 }); }
        catch (error) { throw new Error(`Could not fetch message ${messageId} from channel ${channelId}: ${error instanceof Error ? error.message : String(error)}`); }
        if (activation !== context || activation.signal.aborted) return;
        if (!Array.isArray(response?.body)) throw new Error(`Could not load message ${messageId} from channel ${channelId}: expected a message array, received ${response?.body === null ? 'null' : typeof response?.body}.`);
        const raw = response.body.find((value: any) => value?.id === messageId && value.channel_id === channelId);
        if (!raw) throw new Error(`Message ${messageId} was not found in channel ${channelId}.`);
        const message = messages.getMessages(channelId).receiveMessage(raw).get(messageId);
        if (!message) throw new Error(`Discord could not create a preview record for message ${messageId} in channel ${channelId}.`);
        return message;
    })();
    pending.set(key, task);
    try { return await task; } finally { if (pending.get(key) === task) pending.delete(key); }
}
function MessagePreview({ channelId, messageId }: { channelId: string; messageId: string }): any {
    const ctx = context!;
    const messages = store('MessageStore'), preferences = store('UserSettingsProtoStore');
    const [, refresh] = ctx.react.useState(0);
    const [state, setState] = ctx.react.useState<{ message?: any; error?: string }>({});
    settings.use(['display']);
    ctx.react.useEffect(() => {
        const changed = () => refresh(value => value + 1);
        messages.addChangeListener(changed); preferences.addChangeListener(changed);
        return () => { messages.removeChangeListener(changed); preferences.removeChangeListener(changed); };
    }, [messages, preferences]);
    ctx.react.useEffect(() => {
        let mounted = true; setState({});
        void loadMessage(channelId, messageId).then(message => {
            if (mounted && ctx === context && !ctx.signal.aborted) setState({ message });
        }).catch(error => {
            if (mounted && ctx === context && !ctx.signal.aborted) setState({ error: error instanceof Error ? error.message : String(error) });
        });
        return () => { mounted = false; };
    }, [channelId, messageId]);
    const message = messages.getMessage(channelId, messageId) ?? state.message;
    if (state.error) return <span>{state.error}</span>;
    if (!message) return <span>Loading...</span>;
    const channel = store('ChannelStore').getChannel(channelId);
    if (!channel) return <span>Channel {channelId} is not available.</span>;
    const Component = find(value => {
        const fn = value?.type || value?.render || value;
        return typeof fn === 'function' && String(fn).includes('childrenExecutedCommand:') && String(fn).includes('.hideAccessories');
    }, 'message component');
    const compact = settings.store.display === 'compact' ? true : settings.store.display === 'cozy' ? false : preferences.settings.textAndImages?.messageDisplayCompact?.value ?? false;
    return React.createElement(Component, { id: `message-link-tooltip-${messageId}`, message, channel, subscribeToComponentDispatch: false, compact });
}
function ErrorBoundary(props: any): any {
    const ctx = context!, NativeReact = ctx.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { error: null as Error | null };
        static getDerivedStateFromError(error: Error) { return { error }; }
        componentDidCatch(error: Error) { ctx.log.error('Could not display the message preview.', error); }
        render() { return this.state.error ? React.createElement('span', null, this.state.error.message) : this.props.children; }
    };
    return React.createElement(Boundary, props);
}
function withTooltip(Component: any, props: any, messageId?: string, channelId?: string): any {
    if (!context || context.signal.aborted || !messageId || !channelId) return React.createElement(Component, props);
    const Tooltip = find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip');
    return React.createElement(Tooltip, { tooltipClassName: 'c98-message-link-tooltip', text: <ErrorBoundary key={`${channelId}/${messageId}`}><MessagePreview channelId={channelId} messageId={messageId} /></ErrorBoundary>,
        children: ({ onMouseEnter, onMouseLeave }: any) => React.createElement(Component, { ...props,
            onMouseEnter(event: unknown) { props.onMouseEnter?.(event); onMouseEnter(event); },
            onMouseLeave(event: unknown) { props.onMouseLeave?.(event); onMouseLeave(event); }
        }) });
}
export function MentionTooltip({ Component, vcProps, ...props }: any): any {
    settings.use(['onLink']);
    return withTooltip(Component, props, settings.store.onLink ? vcProps?.messageId : undefined, vcProps?.channelId);
}
export function ReplyTooltip({ Component, vcProps, ...props }: any): any {
    settings.use(['onReply']);
    const reference = vcProps?.baseMessage?.messageReference;
    return withTooltip(Component, props, settings.store.onReply ? reference?.message_id : undefined, reference?.channel_id);
}
export function ForwardTooltip({ Component, vcProps, ...props }: any): any {
    settings.use(['onForward']);
    const reference = vcProps?.message?.messageReference;
    return withTooltip(Component, props, settings.store.onForward ? reference?.message_id : undefined, reference?.channel_id);
}
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'message-link-preview', find: '"channelMention",children:[null', replacement: {
        match: new RegExp(String.raw`(?<=\.jsxs\)\()(\i\.\i),\{(?=role:"link")`.replaceAll('\\i', identifier)), replace: '$self.MentionTooltip,{Component:$1,vcProps:arguments[0],'
    } },
    { id: 'reply-preview', find: '["1i+hMi"]', replacement: {
        match: new RegExp(String.raw`(\i\.\i),\{(?=className:\i\(\)\(\i\.\i,\i\.\i)`.replaceAll('\\i', identifier), 'g'), replace: '$self.ReplyTooltip,{Component:$1,vcProps:arguments[0],'
    } },
    { id: 'forward-preview', find: '.ToyvLk', replacement: {
        match: new RegExp(String.raw`(\i\.\i),\{(?=className:\i\.\i,onClick:\i)`.replaceAll('\\i', identifier), 'g'), replace: '$self.ForwardTooltip,{Component:$1,vcProps:arguments[0],'
    } }
];
export function start(ctx: RendererContext): void {
    context = ctx; nativeReact = ctx.react; Boundary = undefined; pending.clear();
    ctx.styles.add('.c98-message-link-tooltip{width:max-content;max-width:80vw}');
}
export function stop(): void { context = undefined; Boundary = undefined; pending.clear(); }
