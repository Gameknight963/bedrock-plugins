using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using Bedrock;
using System.Windows.Forms;

[assembly: BedrockPlugin(typeof(Bedrock.NativeMenus.NativeMenusPlugin), RequiresApi = "1.0.0")]

namespace Bedrock.NativeMenus;

internal sealed class MenuNode
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "item";
    public string Label { get; set; } = "";
    public string Description { get; set; } = "";
    public bool Disabled { get; set; }
    public bool Checked { get; set; }
    public bool HasAction { get; set; }
    public bool Dangerous { get; set; }
    public bool KeepOpenOnShift { get; set; }
    public double Value { get; set; }
    public double Min { get; set; }
    public double Max { get; set; } = 100;
    public double Step { get; set; } = 1;
    public string Text { get; set; } = "";
    public List<MenuNode> Children { get; set; } = new();
}

internal sealed class Command
{
    public string Kind { get; set; } = "";
    public string Client { get; set; } = "";
    public string Session { get; set; } = "";
    public double X { get; set; }
    public double Y { get; set; }
    public double PixelRatio { get; set; } = 1;
    public string Owner { get; set; } = "0";
    public string Background { get; set; } = "#202024";
    public string Foreground { get; set; } = "#eeeeee";
    public List<MenuNode> Items { get; set; } = new();
}

internal sealed class MenuColors : ProfessionalColorTable
{
    private readonly Color background;
    public MenuColors(Color background) { this.background = background; UseSystemColors = false; }
    public override Color ToolStripDropDownBackground => background;
    public override Color ImageMarginGradientBegin => background;
    public override Color ImageMarginGradientMiddle => background;
    public override Color ImageMarginGradientEnd => background;
    public override Color MenuBorder => Color.FromArgb(90, 90, 95);
    public override Color MenuItemSelected => Color.FromArgb(65, 70, 90);
    public override Color MenuItemSelectedGradientBegin => MenuItemSelected;
    public override Color MenuItemSelectedGradientEnd => MenuItemSelected;
    public override Color MenuItemPressedGradientBegin => MenuItemSelected;
    public override Color MenuItemPressedGradientMiddle => MenuItemSelected;
    public override Color MenuItemPressedGradientEnd => MenuItemSelected;
}

internal sealed class ActionMenuItem : ToolStripMenuItem
{
    public ActionMenuItem(string label) : base(label) { }

    protected override void OnMouseUp(MouseEventArgs args)
    {
        if (args.Button != MouseButtons.Left) { base.OnMouseUp(args); return; }
        // Discord allows a label action and a submenu on the same item.
        int arrowWidth = 24 * (Owner?.DeviceDpi ?? 96) / 96;
        if (args.X < Width - arrowWidth) PerformClick();
    }

    protected override bool ProcessCmdKey(ref Message message, Keys keyData)
    {
        if (Selected && keyData == Keys.Enter) { PerformClick(); return true; }
        return base.ProcessCmdKey(ref message, keyData);
    }
}

public sealed class NativeMenusPlugin : Plugin
{
    private static readonly Setting<bool> Transparency = new("transparency", true) {
        Label = "Transparent background", Description = "Blur the background behind menus." };
    public override IReadOnlyList<SettingDefinition> Settings => [Transparency];
    private readonly Dictionary<string, PluginWindow> clients = new();
    private PluginContext context = null!;
    private Form keyboardOwner = null!;
    private ContextMenuStrip? current;
    private IDisposable? requests;
    private IDisposable? changes;
    private bool transparent;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool ClientToScreen(IntPtr window, ref Point point);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr window);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, IntPtr process);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint from, uint to, bool attach);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int key);

    public override async Task StartAsync(PluginContext context)
    {
        this.context = context;
        transparent = await context.Settings.GetAsync(Transparency);
        await context.InvokeUIAsync(CreateOwner);
        requests = context.Subscribe("native-menus.request", ReceiveAsync);
        changes = context.Subscribe("settings.changed", SettingsChangedAsync);
    }

    private void CreateOwner()
    {
        // ToolStrip needs a window on its own thread to receive keyboard input.
        keyboardOwner = new Form { FormBorderStyle = FormBorderStyle.None, ShowInTaskbar = false,
            StartPosition = FormStartPosition.Manual, Size = new Size(1, 1) };
        _ = keyboardOwner.Handle;
    }

    private async Task SettingsChangedAsync(PluginEvent value)
    {
        if (value.Id != context.Id) return;
        bool enabled = await context.Settings.GetAsync(Transparency);
        await context.InvokeUIAsync(() => transparent = enabled);
    }

    private async Task ReceiveAsync(PluginEvent value)
    {
        if (value.Id != context.Id || context.CancellationToken.IsCancellationRequested) return;
        Command? command = value.Value.Deserialize<Command>(PluginContext.JsonOptions);
        if (command == null) return;
        try
        {
            if (command.Kind != "show" || !Guid.TryParse(command.Client, out _) || !Guid.TryParse(command.Session, out _) ||
                !double.IsFinite(command.X) || !double.IsFinite(command.Y) || !double.IsFinite(command.PixelRatio) ||
                command.PixelRatio <= 0 || command.PixelRatio > 16) throw new InvalidOperationException("Invalid menu request.");
            PluginWindow owner = await OwnerAsync(command.Client);
            command.Owner = owner.Handle;
            await context.InvokeUIAsync(() => ShowIfActive(command));
        }
        catch (Exception error)
        {
            Write(new { kind = "error", client = command.Client, session = command.Session, message = error.Message });
        }
    }

    private void ShowIfActive(Command command)
    {
        if (!context.CancellationToken.IsCancellationRequested) Handle(command);
    }

    private async Task<PluginWindow> OwnerAsync(string client)
    {
        if (clients.TryGetValue(client, out PluginWindow? cached) && IsWindow(new IntPtr(long.Parse(cached.Handle)))) return cached;
        IReadOnlyList<PluginWindow> windows = await context.Windows.GetAllAsync();
        foreach (PluginWindow window in windows)
        {
            context.CancellationToken.ThrowIfCancellationRequested();
            JsonElement identity;
            try
            {
                // The bridge identifies its own renderer without reading Discord account state.
                identity = await context.Windows.ExecuteJavaScriptAsync(window.Id,
                    "globalThis[Symbol.for(\"bedrock.native-menus.client\")] ?? null");
            }
            catch (InvalidOperationException) { continue; }
            if (identity.ValueKind != JsonValueKind.String || identity.GetString() != client) continue;
            clients[client] = window;
            return window;
        }
        throw new InvalidOperationException("Could not identify the Discord window that opened this menu.");
    }

    private void Handle(Command command)
    {
        try
        {
            if (command.Kind == "close") { current?.Close(); return; }
            if (command.Kind != "show") throw new InvalidDataException("Unknown menu request.");
            current?.Close();
            ContextMenuStrip menu = new DesktopMenu(transparent) { ShowImageMargin = true, ShowCheckMargin = false };
            current = menu;
            Color background = ColorTranslator.FromHtml(command.Background);
            Color foreground = ColorTranslator.FromHtml(command.Foreground);
            menu.BackColor = transparent ? Color.FromArgb(0, background) : background;
            menu.ForeColor = foreground;
            menu.Renderer = new MenuRenderer(background, transparent);
            AddItems(menu.Items, command.Items, menu, command, background, foreground, 0);
            menu.Closing += (sender, args) => KeepReactionOpen(menu, args);
            menu.Closed += (sender, args) => Closed(menu, command, args.CloseReason);
            Point anchor = new(checked((int)Math.Round(command.X * command.PixelRatio, MidpointRounding.AwayFromZero)), checked((int)Math.Round(command.Y * command.PixelRatio, MidpointRounding.AwayFromZero)));
            IntPtr source = new(long.Parse(command.Owner));
            if (!ClientToScreen(source, ref anchor)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Could not locate the menu anchor.");
            keyboardOwner.Location = anchor;
            if (long.TryParse(command.Owner, out long owner))
                SetWindowLongPtr(keyboardOwner.Handle, -8, new IntPtr(owner));
            keyboardOwner.Show();
            FocusMenu(new IntPtr(owner));
            menu.Show(keyboardOwner, keyboardOwner.PointToClient(anchor));
            menu.Focus();
            Write(new { kind = "shown", client = command.Client, session = command.Session });
        }
        catch (Exception exception)
        {
            current?.Dispose(); current = null;
            keyboardOwner.Hide();
            if (long.TryParse(command.Owner, out long owner) && owner != 0) SetForegroundWindow(new IntPtr(owner));
            Write(new { kind = "error", client = command.Client, session = command.Session, message = exception.Message });
        }
    }

    private void FocusMenu(IntPtr owner)
    {
        uint thread = GetCurrentThreadId();
        uint ownerThread = GetWindowThreadProcessId(owner, IntPtr.Zero);
        // The menu and Discord have separate UI threads. Join their input queues only while transferring focus.
        bool attached = owner != IntPtr.Zero && GetForegroundWindow() == owner && ownerThread != thread &&
            AttachThreadInput(thread, ownerThread, true);
        try { SetForegroundWindow(keyboardOwner.Handle); keyboardOwner.Activate(); }
        finally { if (attached) AttachThreadInput(thread, ownerThread, false); }
    }

    private void AddItems(ToolStripItemCollection target, List<MenuNode> nodes, ContextMenuStrip root,
        Command command, Color background, Color foreground, int depth)
    {
        if (depth > 20) throw new InvalidDataException("Menu nesting exceeds twenty levels.");
        foreach (MenuNode node in nodes)
        {
            if (node.Type == "separator") { target.Add(new ToolStripSeparator()); continue; }
            if (node.Type == "slider")
            {
                if (node.Max <= node.Min || double.IsNaN(node.Value) || double.IsInfinity(node.Value))
                    throw new InvalidDataException("Invalid slider range.");
                Label label = new() { AutoSize = true, Text = node.Label, ForeColor = foreground, BackColor = background };
                TrackBar slider = new() { Minimum = 0, Maximum = 1000, TickStyle = TickStyle.None,
                    Width = 220, Height = 28, AutoSize = false, BackColor = background, Enabled = !node.Disabled,
                    AccessibleName = node.Label, AccessibleRole = AccessibleRole.Slider };
                double range = node.Max - node.Min;
                slider.Value = Math.Max(0, Math.Min(1000, (int)Math.Round((node.Value - node.Min) / range * 1000)));
                slider.SmallChange = Math.Max(1, (int)Math.Round(node.Step / range * 1000));
                Panel panel = new() { Size = new Size(240, 58), BackColor = background };
                label.Location = new Point(8, 2);
                slider.Location = new Point(8, 23);
                panel.Controls.Add(label); panel.Controls.Add(slider);
                slider.ValueChanged += (sender, args) => ChangeSlider(slider, label, node, command);
                target.Add(new ToolStripControlHost(panel) { AutoSize = false, Size = panel.Size });
                continue;
            }
            if (node.Type == "text")
            {
                if (node.Label.Length != 0) target.Add(new ToolStripLabel(node.Label) { ForeColor = foreground });
                ToolStripTextBox text = new() { Text = node.Text, Enabled = !node.Disabled, AccessibleName = node.Label };
                text.TextChanged += (sender, args) => Reply(command, node, "change", text.Text);
                target.Add(text);
                continue;
            }
            string labelText = node.Label.Replace("&", "&&");
            ToolStripMenuItem item = node.HasAction && node.Children.Count != 0 ? new ActionMenuItem(labelText) : new ToolStripMenuItem(labelText);
            item.Enabled = !node.Disabled && node.Type != "label" && node.Type != "placeholder";
            item.Checked = node.Checked;
            item.ToolTipText = node.Description;
            item.ForeColor = node.Type == "placeholder" ? Color.Goldenrod : node.Dangerous ? Color.Salmon : foreground;
            item.BackColor = transparent ? Color.FromArgb(0, background) : background;
            item.AccessibleName = node.Label;
            item.Tag = node;
            if (node.Children.Count != 0)
            {
                item.DropDown = new DesktopDropDown(transparent);
                item.DropDown.BackColor = transparent ? Color.FromArgb(0, background) : background; item.DropDown.ForeColor = foreground;
                item.DropDown.Renderer = root.Renderer;
                AddItems(item.DropDownItems, node.Children, root, command, background, foreground, depth + 1);
            }
            if (node.HasAction) item.Click += (sender, args) => Activate(root, command, node);
            target.Add(item);
        }
    }

    private void ChangeSlider(TrackBar slider, Label label, MenuNode node, Command command)
    {
        double value = node.Min + slider.Value / 1000d * (node.Max - node.Min);
        if (node.Step > 0) value = node.Min + Math.Round((value - node.Min) / node.Step) * node.Step;
        value = Math.Max(node.Min, Math.Min(node.Max, value));
        label.Text = node.Label + "  " + value.ToString("0.##", CultureInfo.CurrentCulture);
        Reply(command, node, "change", value);
    }

    private void Activate(ContextMenuStrip menu, Command command, MenuNode node)
    {
        Reply(command, node, "action", null);
        if (!node.KeepOpenOnShift || (Modifiers() & Keys.Shift) == 0)
        {
            menu.Close(ToolStripDropDownCloseReason.ItemClicked);
            if (long.TryParse(command.Owner, out long owner) && owner != 0) SetForegroundWindow(new IntPtr(owner));
        }
    }

    private static void KeepReactionOpen(ToolStripDropDown menu, ToolStripDropDownClosingEventArgs args)
    {
        if (args.CloseReason != ToolStripDropDownCloseReason.ItemClicked || (Modifiers() & Keys.Shift) == 0) return;
        foreach (ToolStripItem item in menu.Items)
        {
            if (item.Selected && item.Tag is MenuNode node && node.KeepOpenOnShift) { args.Cancel = true; return; }
            if (item is ToolStripMenuItem parent && parent.DropDown.Visible) KeepReactionOpen(parent.DropDown, args);
        }
    }

    private void Reply(Command command, MenuNode node, string kind, object? value)
    {
        Keys modifiers = Modifiers();
        Write(new { kind, client = command.Client, session = command.Session, id = node.Id, value,
            keepOpen = kind == "action" && node.KeepOpenOnShift && (modifiers & Keys.Shift) != 0,
            shiftKey = (modifiers & Keys.Shift) != 0, ctrlKey = (modifiers & Keys.Control) != 0,
            altKey = (modifiers & Keys.Alt) != 0 });
    }

    private static Keys Modifiers() =>
        (GetAsyncKeyState(16) < 0 ? Keys.Shift : Keys.None) |
        (GetAsyncKeyState(17) < 0 ? Keys.Control : Keys.None) |
        (GetAsyncKeyState(18) < 0 ? Keys.Alt : Keys.None);

    private void Closed(ContextMenuStrip menu, Command command, ToolStripDropDownCloseReason reason)
    {
        if (current == menu) current = null;
        keyboardOwner.Hide();
        if ((reason == ToolStripDropDownCloseReason.ItemClicked || reason == ToolStripDropDownCloseReason.Keyboard) &&
            long.TryParse(command.Owner, out long owner) && owner != 0) SetForegroundWindow(new IntPtr(owner));
        // ToolStrip closes before invoking the selected item's Click handler.
        _ = context.InvokeUIAsync(() => FinishClosed(menu, command, reason));
    }

    private void FinishClosed(ContextMenuStrip menu, Command command, ToolStripDropDownCloseReason reason)
    {
        Write(new { kind = "closed", client = command.Client, session = command.Session, reason = reason.ToString() });
        menu.Dispose();
    }

    public override async Task StopAsync()
    {
        requests?.Dispose(); requests = null;
        changes?.Dispose(); changes = null;
        clients.Clear();
        await context.InvokeUIAsync(CloseMenus);
    }

    private void CloseMenus()
    {
        ContextMenuStrip? menu = current;
        menu?.Close(); menu?.Dispose(); current = null;
        keyboardOwner?.Dispose();
    }

    private void Write(object message) => _ = WriteAsync(message);
    private async Task WriteAsync(object message)
    {
        if (context.CancellationToken.IsCancellationRequested) return;
        try { await context.EmitAsync("native-menus.reply", message); }
        catch (Exception error) { if (!context.CancellationToken.IsCancellationRequested) context.Log.Error(error.Message); }
    }
}
