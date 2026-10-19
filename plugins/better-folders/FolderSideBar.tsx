/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import { React, ErrorBoundary, findComponentByCodeLazy, Animations, ChannelRTCStore, ExpandedGuildFolderStore, SortedGuildStore, useStateFromStores } from './discord.js';
import { settings } from './renderer.js';
const GuildsBar = findComponentByCodeLazy('("guildsnav")');

function getExpandedFolderIds() {
    const expandedFolders = ExpandedGuildFolderStore.getExpandedFolders();
    const folders = SortedGuildStore.getGuildFolders();

    const expandedFolderIds = new Set<number>();

    for (const folder of folders) {
        if (expandedFolders.has(folder.folderId!) && folder.guildIds?.length) {
            expandedFolderIds.add(folder.folderId!);
        }
    }

    return expandedFolderIds;
}

export default ErrorBoundary.wrap((guildsBarProps: any) => {
    settings.use(["sidebarAnim"]);
    const expandedFolderIds = useStateFromStores([ExpandedGuildFolderStore, SortedGuildStore], () => getExpandedFolderIds());
    const isFullscreen = useStateFromStores([ChannelRTCStore], () => ChannelRTCStore.isFullscreenInContext());

    const Sidebar = (
        <GuildsBar
            {...guildsBarProps}
            isBetterFolders={true}
            betterFoldersExpandedIds={expandedFolderIds}
        />
    );

    const visible = !!expandedFolderIds.size;
    const guilds = document.querySelector(guildsBarProps.className.split(" ").map((c: string) => `.${c}`).join(""));

    // We need to display none if we are in fullscreen. Yes this seems horrible doing with css, but it's literally how Discord does it.
    // Also display flex otherwise to fix scrolling.
    const sidebarStyle = {
        display: isFullscreen ? "none" : "flex"
    } ;

    if (!guilds || !settings.store.sidebarAnim) {
        return visible
            ? <div className="vc-betterFolders-sidebar" style={sidebarStyle}>{Sidebar}</div>
            : null;
    }

    return (
        <Animations.Transition
            items={visible}
            from={{ width: 0 }}
            enter={{ width: guilds.getBoundingClientRect().width }}
            leave={{ width: 0 }}
            config={{ duration: 200 }}
        >
            {(animationStyle: any, show: any) =>
                show && (
                    <Animations.animated.div className="vc-betterFolders-sidebar" style={{ ...animationStyle, ...sidebarStyle }}>
                        {Sidebar}
                    </Animations.animated.div>
                )
            }
        </Animations.Transition>
    );
}, { noop: true });
