/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
import { GoogleLanguages, DeeplLanguages, KagiLanguages } from './languages.js';

export const settings = Bedrock.definePluginSettings({
    service: { type: Bedrock.OptionType.SELECT, label: 'Translation Provider', default: 'google', options: [
        { label: 'Google Translate', value: 'google' }, { label: 'DeepL Free', value: 'deepl' }, { label: 'DeepL Pro', value: 'deepl-pro' }, { label: 'Kagi Translate', value: 'kagi' }
    ], onChange() { if (typeof window !== 'undefined') void resetLanguageDefaults(); } },
    deeplApiKey: { type: Bedrock.OptionType.STRING, label: 'DeepL API Key', description: 'Your DeepL API key from deepl.com/your-account.', default: '' },
    kagiSession: { type: Bedrock.OptionType.STRING, label: 'Kagi Session Token', description: 'Your Kagi session token from kagi.com/settings?p=user_details.', default: '' },
    autoTranslate: { type: Bedrock.OptionType.BOOLEAN, label: 'Auto Translate', description: 'Translate your messages before sending. Shift-click or right-click the chat-input button to toggle this.', default: false },
    showAutoTranslateTooltip: { type: Bedrock.OptionType.BOOLEAN, label: 'Show Auto Translate Tooltip', description: 'Show a tooltip when a message is auto-translated.', default: true }
});
export type LanguageKey = 'receivedInput' | 'receivedOutput' | 'sentInput' | 'sentOutput';
let storage: RendererContext['settings'];
export function configureLanguages(value: RendererContext['settings']): void { storage = value; }
export function getLanguage(key: LanguageKey): string {
    const deepL = settings.store.service.startsWith('deepl');
    return storage.get(key, key.endsWith('Input') ? deepL ? '' : 'auto' : deepL ? 'en-us' : 'en');
}
export function setLanguage(key: LanguageKey, value: string): Promise<void> { return storage.set(key, value); }
export function getLanguages(provider = settings.store.service): Record<string, string> {
    return provider === 'google' ? GoogleLanguages : provider === 'kagi' ? KagiLanguages : DeeplLanguages;
}
export async function resetLanguageDefaults(): Promise<void> {
    const deepL = settings.store.service.startsWith('deepl');
    for (const key of ['receivedInput', 'sentInput'] as const) await setLanguage(key, deepL ? '' : 'auto');
    for (const key of ['receivedOutput', 'sentOutput'] as const) await setLanguage(key, deepL ? 'en-us' : 'en');
}
