/* Copyright (c) 2023-2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
import { googleClientKey } from './google-client.js';
import { deeplLanguageToGoogleLanguage } from './languages.js';
export { settings } from './settings.js';

type MainContext = Pick<RendererContext, 'id' | 'signal' | 'events' | 'settings'>;
export interface TranslationRequest { requestId: string; text: string; source: string; target: string }
export interface TranslationValue { provider: string; sourceLanguage: string; text: string; notice?: string }
export async function translateRequest(ctx: MainContext, request: TranslationRequest): Promise<TranslationValue> {
    if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 50000 ||
        typeof request.source !== 'string' || typeof request.target !== 'string' || !/^[a-z-]{0,20}$/i.test(request.source) || !/^[a-z-]{2,20}$/i.test(request.target))
        throw new Error('Choose valid translation languages and a nonempty message.');
    const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(25000)]);
    async function google(source: string, target: string): Promise<TranslationValue> {
        const url = new URL('https://translate-pa.googleapis.com/v1/translate');
        url.search = new URLSearchParams({ 'params.client': 'gtx', dataTypes: 'TRANSLATION', key: googleClientKey, 'query.sourceLanguage': source || 'auto', 'query.targetLanguage': target, 'query.text': request.text }).toString();
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Google Translate rejected the request (HTTP ${response.status}).`);
        const body = await response.json() as { translation?: string; sourceLanguage?: string };
        if (typeof body.translation !== 'string') throw new Error('Google Translate returned no translation.');
        return { provider: 'google', text: body.translation, sourceLanguage: body.sourceLanguage ?? source };
    }
    const service = ctx.settings.get('service', 'google');
    if (service === 'google') return google(request.source, request.target);
    if (service === 'deepl' || service === 'deepl-pro') {
        const key = ctx.settings.get('deeplApiKey', '');
        if (!key) {
            await ctx.settings.set('service', 'google');
            return { ...await google(deeplLanguageToGoogleLanguage(request.source), deeplLanguageToGoogleLanguage(request.target)), notice: 'DeepL API key is not set. Using Google Translate.' };
        }
        const response = await fetch(service === 'deepl-pro' ? 'https://api.deepl.com/v2/translate' : 'https://api-free.deepl.com/v2/translate', {
            method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${key}` },
            body: JSON.stringify({ text: [request.text], target_lang: request.target, ...(request.source && request.source !== 'auto' ? { source_lang: request.source.split('-')[0] } : {}) })
        });
        if (response.status === 456) return { ...await google(deeplLanguageToGoogleLanguage(request.source), deeplLanguageToGoogleLanguage(request.target)), notice: 'DeepL quota exceeded. Using Google Translate.' };
        if (!response.ok) throw new Error(response.status === 403 ? 'The DeepL API key or account type is invalid.' : `DeepL rejected the request (HTTP ${response.status}).`);
        const body = await response.json() as { translations?: { text: string; detected_source_language: string }[] };
        const translation = body.translations?.[0];
        if (!translation || typeof translation.text !== 'string') throw new Error('DeepL returned no translation.');
        return { provider: service, text: translation.text, sourceLanguage: translation.detected_source_language.toLowerCase() };
    }
    if (service === 'kagi') {
        const token = ctx.settings.get('kagiSession', '');
        if (!token) throw new Error('Enter your Kagi session token in the plugin settings.');
        const response = await fetch('https://translate.kagi.com/api/translate', { method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', Cookie: `kagi_session=${token}` },
            body: JSON.stringify({ text: request.text, from: request.source, to: request.target, model: 'standard' }) });
        if (!response.ok) throw new Error(response.status === 401 ? 'The Kagi session token is invalid or expired.' : `Kagi rejected the request (HTTP ${response.status}).`);
        const body = await response.json() as { translation?: string; detected_language?: { label?: string } };
        if (typeof body.translation !== 'string') throw new Error('Kagi returned no translation.');
        return { provider: service, text: body.translation, sourceLanguage: body.detected_language?.label ?? request.source };
    }
    throw new Error('Choose a supported translation provider.');
}
export function start(ctx: MainContext): void {
    ctx.events.on('translate.request', async ({ id, value }) => {
        if (id !== ctx.id || !value || typeof value.requestId !== 'string') return;
        let response: Record<string, unknown>;
        try { response = { requestId: value.requestId, translation: await translateRequest(ctx, value) }; }
        catch (error) { response = { requestId: value.requestId, error: error instanceof Error ? error.message : 'The translation request failed.' }; }
        if (!ctx.signal.aborted) await ctx.events.emit('translate.response', response);
    });
}
