/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React, Button, openModal } from "./discord.js";
import { SessionInfo } from "./types.js";
import { cl } from "./utils.js";


import { RenameModal } from "./RenameModal.js";

export function RenameButton({ session, state }: { session: SessionInfo["session"], state: [string, (value: string) => void]; }) {
    return (
        <Button
            variant="secondary"
            size="xs"
            className={cl("rename-btn")}
            onClick={() =>
                openModal(props => (
                    <RenameModal
                        props={props}
                        session={session}
                        state={state}
                    />
                ))
            }
        >
            Rename
        </Button>
    );
}

export function NewButton() {
    return (
        <Button
            variant="dangerPrimary"
            size="min"
            className={cl("new-btn")}
        >
            NEW
        </Button>
    );
}
