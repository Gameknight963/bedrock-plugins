/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { RendererContext } from '@bedrock/renderer';
import { React, Button, ConnectedAccountActions, ShowCurrentGame, ConnectedAccountsStore, Menu, Popout, useRef, useState, useStateFromStores, setContext, active, normalizePatches } from './discord.js';
type UserAreaRenderProps = { nameplate?: unknown };
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    oldIcon: {
        label: "Use the old icon",
        type: OptionType.BOOLEAN,
        description: "Use the old icon style before Discord icon redesign",
        default: false
    },

});

function Icon({ className }: { className?: string; }) {
    const { oldIcon } = settings.use(["oldIcon"]);
    const showCurrentGame = ShowCurrentGame.useSetting();

    const redLinePath = !oldIcon
        ? "M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z"
        : "M23 2.27 21.73 1 1 21.73 2.27 23 23 2.27Z";

    const maskBlackPath = !oldIcon
        ? "M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z"
        : "M23.27 4.54 19.46.73 .73 19.46 4.54 23.27 23.27 4.54Z";

    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24">
            <path
                fill={!showCurrentGame && !oldIcon ? "var(--status-danger)" : "currentColor"}
                mask={!showCurrentGame ? "url(#gameActivityMask)" : void 0}
                d="M3.06 20.4q-1.53 0-2.37-1.065T.06 16.74l1.26-9q.27-1.8 1.605-2.97T6.06 3.6h11.88q1.8 0 3.135 1.17t1.605 2.97l1.26 9q.21 1.53-.63 2.595T20.94 20.4q-.63 0-1.17-.225T18.78 19.5l-2.7-2.7H7.92l-2.7 2.7q-.45.45-.99.675t-1.17.225Zm14.94-7.2q.51 0 .855-.345T19.2 12q0-.51-.345-.855T18 10.8q-.51 0-.855.345T16.8 12q0 .51.345 .855T18 13.2Zm-2.4-3.6q.51 0 .855-.345T16.8 8.4q0-.51-.345-.855T15.6 7.2q-.51 0-.855.345T14.4 8.4q0 .51.345 .855T15.6 9.6ZM6.9 13.2h1.8v-2.1h2.1v-1.8h-2.1v-2.1h-1.8v2.1h-2.1v1.8h2.1v2.1Z"
            />
            {!showCurrentGame && <>
                <path fill="var(--status-danger)" d={redLinePath} />
                <mask id="gameActivityMask">
                    <rect fill="white" x="0" y="0" width="24" height="24" />
                    <path fill="black" d={maskBlackPath} />
                </mask>
            </>}
        </svg>
    );
}

function GameActivityToggleButton(props: UserAreaRenderProps) {
    const showCurrentGame = ShowCurrentGame.useSetting();

    const connectedAccounts = useStateFromStores([ConnectedAccountsStore], () => ConnectedAccountsStore.getAccounts());
    const spotifyAccounts = connectedAccounts.filter(account => account.type === "spotify" && !account.revoked);
    // The update is an API request which takes a bit to update the store, so keep local overrides to reflect changes immediately
    const [spotifyActivityOverrides, setSpotifyActivityOverrides] = useState<Record<string, boolean>>({});

    const buttonRef = useRef<HTMLButtonElement | null>(null);


    const buttonProps = {
        tooltipText: showCurrentGame ? "Disable Game Activity" : "Enable Game Activity",
        icon: Icon,
        role: "switch",
        ariaChecked: !showCurrentGame,
        redGlow: !showCurrentGame,
        plated: props?.nameplate != null,
        onClick: () => ShowCurrentGame.updateSetting(old => !old)
    };

    if (spotifyAccounts.length === 0)
        return <Button {...buttonProps} />;

    return (
        <Popout
            position="top"
            align="left"
            targetElementRef={buttonRef}
            renderPopout={({ closePopout }) => (
                <Menu.Menu navId="vc-gameActivityToggle-menu" onClose={closePopout}>
                    {spotifyAccounts.map(account => {
                        const checked = spotifyActivityOverrides[account.id] ?? account.showActivity;

                        return (
                            <Menu.MenuCheckboxItem
                                key={account.id}
                                id={`vc-toggle-spotify-${account.id}`}
                                label={spotifyAccounts.length === 1 ? "Share Spotify Activity" : `Share Spotify Activity (${account.name})`}
                                checked={checked}
                                action={() => {
                                    ConnectedAccountActions.setShowActivity(account.type, account.id, !checked);
                                    setSpotifyActivityOverrides(current => ({ ...current, [account.id]: !checked }));
                                }}
                            />
                        );
                    })}
                </Menu.Menu>
            )}
        >
            {popoutProps => (
                <Button
                    ref={buttonRef}
                    onContextMenu={popoutProps.onClick}
                    {...buttonProps}
                />
            )}
        </Popout>
    );
}

const plugin = {
    name: "GameActivityToggle",
    description: "Adds a button next to the mic and deafen button to toggle game activity. Right click it to toggle Spotify activity.",
    settings,

    userAreaButton: {
        icon: Icon,
        render: GameActivityToggleButton
    },

};

export function renderButton(props: UserAreaRenderProps): unknown {
    return active() ? React.createElement(GameActivityToggleButton, props) : null;
}
export const patches = normalizePatches();
export function start(ctx: RendererContext): void { setContext(ctx); }
