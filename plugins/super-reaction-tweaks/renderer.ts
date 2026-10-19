/* Copyright (c) 2023 Vendicated, ant0n, FieryFlames and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

let context: RendererContext;
export const settings = Bedrock.definePluginSettings({
    superReactByDefault: { type: Bedrock.OptionType.BOOLEAN, label: 'Super React by default', description: 'Open the reaction picker in Super Reaction mode.', default: true },
    unlimitedSuperReactionPlaying: { type: Bedrock.OptionType.BOOLEAN, label: 'Unlimited concurrent reactions', description: 'Remove the limit on Super Reactions playing at once.', default: false },
    superReactionPlayingLimit: { type: Bedrock.OptionType.SLIDER, label: 'Concurrent reaction limit', description: 'Maximum playing at once. Set to zero to stop playing Super Reactions. Ignored when the limit is removed.', default: 20, min: 0, max: 100, step: 5 }
});

const identifier = '(?:[A-Za-z_$][\\w$]*)';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
export const patches: SourcePatch[] = [
    { id: 'super-reaction-concurrency', find: ',BURST_REACTION_EFFECT_PLAY', replacement: {
        match: re(String.raw`(BURST_REACTION_EFFECT_PLAY:(?:\i=>|function\(\i\)){.+?if\()(\(?(?:function)?\(\i,\i\)(?:=>)?{.+?\(\i,\i\))>=5+?(?=\))`),
        replace: (_match: string, before: string, count: string) => `${before}!$self.shouldPlayBurstReaction(${count})`
    } },
    { id: 'default-super-reaction-picker', find: '.EMOJI_PICKER_CONSTANTS_EMOJI_CONTAINER_PADDING_HORIZONTAL)', replacement: {
        match: re(String.raw`(openPopoutType:void 0(?=.+?isBurstReaction:(\i).+?\.intention===(\i\.\i\.REACTION)).+?\[\2,\i\]=\i\.useState\()!1\)(?<=pickerIntention:(\i).+?)`),
        replace: (_match: string, before: string, _burstVariable: string, intention: string, picker: string) => `${before}$self.shouldSuperReactByDefault()&&${picker}===${intention})`
    } }
];

export function shouldPlayBurstReaction(playingCount: number): boolean {
    return settings.store.unlimitedSuperReactionPlaying || settings.store.superReactionPlayingLimit > playingCount;
}
export function shouldSuperReactByDefault(): boolean {
    const premium = context.webpack.find<{ getState(): { premiumTypeActual?: number | null } }>(value => value?.getName?.() === 'OverridePremiumTypeStore');
    return settings.store.superReactByDefault && premium?.getState().premiumTypeActual != null;
}
export function start(ctx: RendererContext): void { context = ctx; }
