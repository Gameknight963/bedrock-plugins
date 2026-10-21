/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import { apps } from './rules.js';
export const settings = Bedrock.definePluginSettings(Object.fromEntries(
    Object.entries(apps).map(([id, [label, description]]) => [id, { type: Bedrock.OptionType.BOOLEAN, label, description, default: true }])
));
