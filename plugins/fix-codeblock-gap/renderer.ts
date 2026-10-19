/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

const pattern = '/^```(?:([a-z0-9_+\\-.#]+?)\\n)?\\n*([^\\n][^]*?)\\n*```';
export const patches: SourcePatch[] = [{ id: 'trailing-codeblock-newline', find: pattern,
    replacement: { match: pattern, replace: '$&\\n?' } }];
export function start(): void {}
