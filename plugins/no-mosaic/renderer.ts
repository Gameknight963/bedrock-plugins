/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    inlineVideo: { type: Bedrock.OptionType.BOOLEAN, label: 'Inline Video', description: 'Play videos without opening the media carousel.', default: true }
});
const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [
    { id: 'individual-attachments', find: '"PLAINTEXT_PREVIEW":"OTHER"', replacement: {
        match: new RegExp(String.raw`"IMAGE"===\i\|\|"VIDEO"===\i\|\|"CLIP"===\i`.replaceAll('\\i', identifier)), replace: '(false)'
    } },
    { id: 'attachment-width', find: 'return{visualMediaItems:', replacement: {
        match: new RegExp(String.raw`return{visualMediaItems:.+?props:(\i)(?=.{0,20}?\1\.item\.uniqueId)`.replaceAll('\\i', identifier)),
        replace: '$&,useFullWidth:["IMAGE","VIDEO","CLIP"].includes($1.item?.type)?false:undefined'
    } },
    { id: 'inline-video', find: 'renderAttachments(', replacement: {
        match: new RegExp(String.raw`url:(\i)\.url\}\);return `.replaceAll('\\i', identifier)),
        replace: '$&(!$self.settings.store.inlineVideo||$1.content_type?.startsWith("image/"))&&'
    } }
];
export function start(): void {}
