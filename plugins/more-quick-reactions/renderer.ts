/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    reactionCount: { type: Bedrock.OptionType.NUMBER, label: 'Message action reactions', description: 'Number of reactions in the message actions bar.', default: 5, min: 0, max: 42, step: 1 },
    frequentEmojis: { type: Bedrock.OptionType.BOOLEAN, label: 'Frequently used emoji', description: 'Use frequently used emoji instead of favorites.', default: true, restartNeeded: true },
    rows: { type: Bedrock.OptionType.SLIDER, label: 'Rows', description: 'Rows of quick reactions in the context menu.', default: 2, min: 1, max: 16, step: 1 },
    columns: { type: Bedrock.OptionType.SLIDER, label: 'Columns', description: 'Columns of quick reactions in the context menu.', default: 4, min: 1, max: 12, step: 1 },
    compactMode: { type: Bedrock.OptionType.BOOLEAN, label: 'Compact buttons', description: 'Use smaller reaction buttons. Five or more columns work best.', default: false },
    scroll: { type: Bedrock.OptionType.BOOLEAN, label: 'Scroll reactions', description: 'Scroll the grid to see more emoji.', default: true }
});

const identifier = '[A-Za-z_$][\\w$]*';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
let context: RendererContext;

export const patches: SourcePatch[] = [
    { id: 'popover-reaction-count', find: 'Lv7LxN),children', replacement: {
        match: /(?<=length>=3\?.{0,40})\.slice\(0,3\)/, replace: '.slice(0,$self.settings.store.reactionCount)'
    } },
    { id: 'frequent-emoji-list', find: 'this.favoriteEmojisWithoutFetchingLatest.concat', replacement: {
        match: /^[\s\S]*$/, replace(source: string) { return settings.store.frequentEmojis ? source.replace(/this\.favoriteEmojisWithoutFetchingLatest\.concat/, '[].concat') : source; }
    } },
    { id: 'context-menu-reaction-grid', find: '/iYSo6', replacement: [
        { match: re(String.raw`isEmojiPremiumLocked\(\{.{0,25}channel:(\i),`), replace: '$&guild_id:$1?.guild_id??null,' },
        { match: /"MessageContextMenu"\},\{autoTrackExposure.{0,5}\}\),/, replace: '$&[bedrockReactionOffset,setBedrockReactionOffset]=$self.useScrollState(),' },
        { match: re(String.raw`\.length>4&&\(\i\.length=4\)`), replace: '' },
        { match: re(String.raw`className:(\i\.\i),(?=children:)`), replace: 'className:"vc-better-quick-react "+($self.settings.store.compactMode?"vc-better-quick-react-compact ":"")+$1,style:{"--vc-better-quick-react-columns":$self.settings.store.columns},' },
        { match: re(String.raw`children:(\i)\.map\(`), replace: 'onWheel:$self.onWheelWrapper(bedrockReactionOffset,setBedrockReactionOffset,$1.length),children:$self.applyScroll($1,bedrockReactionOffset).map(' }
    ] },
    { id: 'menu-group-grid-events', find: '.hideInteraction,', all: true, replacement: {
        match: /^[\s\S]*$/, replace(source: string) {
            return re(String.raw`\.groupLabel,\i\.hideInteraction,`).test(source) ? source.replace('role:"group",', 'role:"group",style:arguments[0].style,onWheel:arguments[0].onWheel,') : source;
        }
    } },
    { id: 'menu-grid-width', find: '"--custom-menu-viewport-padding"', replacement: {
        match: re(String.raw`className:\i\(\)\(\i\.menu`), replace: '$&,"vc-better-quick-react-padding"'
    } }
];

export function useScrollState(): [number, (value: number) => void] {
    settings.use(['reactionCount', 'rows', 'columns', 'compactMode', 'scroll']);
    return context.react.useState(0);
}

export function applyScroll<T>(emojis: T[], index: number): T[] {
    const count = settings.store.rows * settings.store.columns;
    const start = Math.max(0, Math.min(index, Math.max(0, emojis.length - count)));
    return emojis.slice(start, start + count);
}

export function onWheelWrapper(offset: number, setOffset: (value: number) => void, length: number): ((event: WheelEvent) => void) | undefined {
    if (!settings.store.scroll) return;
    return event => {
        if (!event.deltaY || event.shiftKey) return;
        event.stopPropagation();
        const count = settings.store.rows * settings.store.columns;
        setOffset(Math.max(0, Math.min(offset + Math.sign(event.deltaY) * settings.store.columns, length - count)));
    };
}

export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add(`
        .vc-better-quick-react { padding:4px 1px 6px; justify-content:center;
            grid-template-columns:repeat(var(--vc-better-quick-react-columns),44px); grid-template-rows:unset; grid-auto-rows:44px; z-index:10; }
        .vc-better-quick-react.vc-better-quick-react-compact { grid-template-columns:repeat(var(--vc-better-quick-react-columns),33px); grid-auto-rows:33px; }
        .vc-better-quick-react.vc-better-quick-react-compact > div { scale:.75; }
        .vc-better-quick-react.vc-better-quick-react-compact img { width:25px; height:25px; }
        .vc-better-quick-react-padding { min-width:fit-content; }
    `);
}
