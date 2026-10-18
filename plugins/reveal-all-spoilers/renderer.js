/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function start(ctx) {
    const reveal = event => {
        if (!event.ctrlKey || !(event.target instanceof Element)) return;
        const clicked = event.target.closest('[class*="spoilerContent_"]');
        if (!clicked) return;
        const message = clicked.closest('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]');
        if (!message) return;
        const scope = event.shiftKey
            ? message.closest('[data-list-id="chat-messages"], [class*="messagesWrapper_"], [role="log"]')
            : message;
        if (!scope) return;
        for (const spoiler of scope.querySelectorAll('[class*="spoilerContent_"][class*="hidden_"]')) {
            if (spoiler !== clicked) spoiler.click();
        }
    };
    document.addEventListener('click', reveal, true);
    ctx.cleanup(() => document.removeEventListener('click', reveal, true));
}
