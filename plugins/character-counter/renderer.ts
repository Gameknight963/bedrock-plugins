/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    colorEffects: { type: Bedrock.OptionType.BOOLEAN, label: 'Color Effects', description: 'Enable yellow/red coloring as you get closer to the character limit.', default: true }
});
const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [
    { id: 'composer-counter', find: '.CREATE_FORUM_POST||', replacement: {
        match: new RegExp(String.raw`(?<=,editorRef:(\i),.{0,200}textValue:(\i),editorHeight:\i,channelId:\i\.id\}\)),\i`.replaceAll('\\i', identifier)),
        replace: ',$self.renderCharCounter({editorRef:$1,text:$2})'
    } },
    { id: 'native-length-tooltip', find: '.PREMIUM_UPSELL);', replacement: {
        match: /(?<=\.PREMIUM_UPSELL\);)(?=.{0,50}\.PREMIUM_UPSELL_VIEWED)/, replace: 'return null;'
    } }
];
interface CounterProps { text: string; editorRef?: { current?: { state?: { focused?: boolean }; props?: { maxCharacterCount?: number } } } }
let context: RendererContext;
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add(`.bedrock-character-counter{font-size:12px;color:var(--text-muted);position:absolute;bottom:4px;right:11px;pointer-events:none;z-index:2;background:transparent;transition:color .3s ease}.bedrock-character-count{transition:color .3s ease}.bedrock-character-selected{color:var(--brand-500)}`);
}

function Counter({ editorRef, text }: CounterProps) {
    const { react } = context;
    const { colorEffects } = settings.use(['colorEffects']);
    const [selected, setSelected] = react.useState(0);
    react.useEffect(() => {
        const listener = () => setSelected(document.getSelection()?.toString().length ?? 0);
        document.addEventListener('selectionchange', listener);
        return () => document.removeEventListener('selectionchange', listener);
    }, []);
    if (!text?.length) return null;
    const users = context.webpack.find<{ getCurrentUser(): { premiumType?: number } | undefined }>(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function');
    const limit = editorRef?.current?.props?.maxCharacterCount ?? (users?.getCurrentUser()?.premiumType === 2 ? 4000 : 2000);
    const percentage = text.length / limit * 100;
    const color = !colorEffects ? 'var(--primary-330)' : percentage < 50 ? 'var(--text-muted)' : percentage < 75 ? 'var(--yellow-330)' : percentage < 90 ? 'var(--orange-330)' : 'var(--red-360)';
    const selection = selected > 0 && editorRef?.current?.state?.focused;
    return react.createElement('div', { className: 'bedrock-character-counter', style: { color } },
        selection ? react.createElement(react.Fragment, null, react.createElement('span', { className: 'bedrock-character-selected' }, String(selected)), '/') : null,
        react.createElement('span', { className: 'bedrock-character-count' }, String(text.length)), '/', String(limit));
}

export function renderCharCounter(props: CounterProps) { return context.react.createElement(Counter, { ...props }); }
