/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RendererContext, SourcePatch } from '@bedrock/renderer';
const { definePluginSettings, OptionType } = Bedrock;
type CodecInfo = { name: string; encode: boolean; [key: string]: unknown };
let context: RendererContext;
export const settings = definePluginSettings({
    disableAv1Codec: {
        label: "Disable AV1",
        description: "Make Discord not consider using AV1 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableH265Codec: {
        label: "Disable H.265",
        description: "Make Discord not consider using H265 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableH264Codec: {
        label: "Disable H.264",
        description: "Make Discord not consider using H264 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableVP8Codec: {
        label: "Disable VP8",
        description: "Make Discord not consider using VP8 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
    disableVP9Codec: {
        label: "Disable VP9",
        description: "Make Discord not consider using VP9 for streaming and cameras.",
        type: OptionType.BOOLEAN,
        default: false
    },
});

export const plugin = {
    name: "StreamingCodecDisabler",
    description: "Disable video codecs of your choice for streaming and cameras.",
    settings,

    patches: [
        {
            find: "lastOverrideCodecDenylist.length",
            replacement: {
                match: /(let \i=)(\i\(\i\))(?=,\i=this\.lastOverrideCodecDenylist\.length)/,
                replace: "$1$self.filterCodecs($2)"
            },
        }
    ],

    filterCodecs(codecs: CodecInfo[]) {
        if (!context || context.signal.aborted) return codecs;
        const disabled: Record<string, boolean> = {
            AV1: settings.store.disableAv1Codec,
            H265: settings.store.disableH265Codec,
            H264: settings.store.disableH264Codec,
            VP8: settings.store.disableVP8Codec,
            VP9: settings.store.disableVP9Codec,
        };
        return codecs.map(c => disabled[c.name] ? { ...c, encode: false } : c);
    },
};
export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({ id: `streaming-codecs-${index}`, find: patch.find,
    replacement: { match: new RegExp(patch.replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), patch.replacement.match.flags), replace: patch.replacement.replace.replaceAll('$self', '$self.plugin') }
}));
export function start(ctx: RendererContext): void { context = ctx; }
