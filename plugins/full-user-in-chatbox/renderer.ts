/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export const patches: SourcePatch[] = [{ id: 'interactive-chatbox-mentions', find: '"text":"locked"', replacement: {
    match: new RegExp(String.raw`(hidePersonalInformation\).+?)(if\(null!=\i\){.+?return \i)(?=})`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: '$1return $self.UserMentionComponent({...arguments[0],originalComponent:()=>{$2}});'
} }];
export function Mention(props: any): any {
    const ctx = context!;
    const users = ctx.webpack.find<any>(value => value?.getName?.() === 'UserStore');
    if (!users) throw new Error("Discord's user store is not available.");
    const [, refresh] = ctx.react.useState(0);
    ctx.react.useEffect(() => {
        const update = () => refresh(value => value + 1);
        users.addChangeListener(update);
        return () => users.removeChangeListener(update);
    }, [users]);
    if (!users.getUser(props.id)) return props.originalComponent();
    const NativeMention = ctx.webpack.find(value => {
        const component = value?.type || value?.render || value;
        return typeof component === 'function' && String(component).includes('.USER_MENTION)');
    });
    if (!NativeMention) return props.originalComponent();
    return ctx.react.createElement(NativeMention, { className: 'mention', userId: props.id, channelId: props.channelId });
}
let Boundary: any;
export function UserMentionComponent(props: any): any {
    if (!context || context.signal.aborted) return props.originalComponent();
    const activation = context;
    Boundary ||= class extends (activation.react as any).Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { activation.log.error('Could not display the chatbox mention.', error); }
        render() { return this.state.failed ? this.props.originalComponent() : this.props.children; }
    };
    return context.react.createElement(Boundary, { originalComponent: props.originalComponent }, context.react.createElement(Mention, props));
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
