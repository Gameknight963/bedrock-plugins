# Native Menus

Renders Discord menus using WinForms. Commands, checkboxes, radio items, submenus, quick reactions and volume sliders appear in desktop popup windows. Menu actions still run through Discord.

Enable **Transparent background** to blur the content behind menus and submenus. Turn it off for an opaque background. Menu colours follow Discord when the menu opens.

Hold Shift when choosing a reaction to keep the menu open. For entries that have both an action and a submenu, click the label to run the action or use the arrow to open the submenu.

Unsupported custom controls appear as amber rows identifying what is not implemented. The remaining menu items remain available. The adapter depends on Discord's menu structure and React properties; changes to those internals can require a plugin update.
