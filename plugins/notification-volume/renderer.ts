/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { SourcePatch } from '@bedrock/renderer';
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    notificationVolume: {
        type: OptionType.SLIDER,
        description: "Notification volume",
        label: "Notification volume",
        min: 0, max: 100, step: 1,
        default: 100,
    }
});

const plugin = {
    name: "NotificationVolume",
    description: "Save your ears and set a separate volume for notifications and in-app sounds",
    settings,
    patches: [
        {
            find: "ensureAudio(){",
            replacement: {
                match: /(?=Math\.min\(\i\.\i\.getOutputVolume\(\)\/100)/g,
                replace: "$self.settings.store.notificationVolume/100*"
            },
        },
    ],
};
export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({
    id: `notification-volume-${index}`, find: patch.find,
    replacement: { ...patch.replacement, match: new RegExp(patch.replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), patch.replacement.match.flags) }
}));
