using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Bedrock.NativeMenus;

internal static class MenuBlur
{
    [StructLayout(LayoutKind.Sequential)]
    private struct AccentPolicy
    {
        public int State;
        public int Flags;
        public uint Color;
        public int Animation;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct CompositionData
    {
        public int Attribute;
        public IntPtr Data;
        public UIntPtr Size;
    }
    [DllImport("user32.dll")]
    private static extern bool SetWindowCompositionAttribute(IntPtr window, ref CompositionData data);

    public static void Apply(IntPtr window)
    {
        // ACCENT_ENABLE_BLURBEHIND (3), passed through WCA_ACCENT_POLICY (19).
        AccentPolicy accent = new() { State = 3 };
        IntPtr memory = Marshal.AllocHGlobal(Marshal.SizeOf<AccentPolicy>());
        try
        {
            Marshal.StructureToPtr(accent, memory, false);
            CompositionData data = new() { Attribute = 19, Data = memory, Size = (UIntPtr)Marshal.SizeOf<AccentPolicy>() };
            if (!SetWindowCompositionAttribute(window, ref data))
                throw new InvalidOperationException("Windows could not enable menu background blur. Turn off Transparent background to use opaque menus.");
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
}

internal sealed class DesktopMenu(bool transparent) : ContextMenuStrip
{
    protected override void OnHandleCreated(EventArgs args)
    {
        base.OnHandleCreated(args);
        if (transparent) MenuBlur.Apply(Handle);
    }
}

internal sealed class DesktopDropDown(bool transparent) : ToolStripDropDownMenu
{
    protected override void OnHandleCreated(EventArgs args)
    {
        base.OnHandleCreated(args);
        if (transparent) MenuBlur.Apply(Handle);
    }
}

internal sealed class MenuRenderer(Color background, bool transparent) : ToolStripProfessionalRenderer(new MenuColors(background))
{
    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs args)
    {
        if (transparent) args.Graphics.Clear(Color.Transparent);
        else base.OnRenderToolStripBackground(args);
    }

    protected override void OnRenderImageMargin(ToolStripRenderEventArgs args)
    {
        if (!transparent) { base.OnRenderImageMargin(args); return; }
        using SolidBrush tint = new(Color.FromArgb(30, background));
        args.Graphics.FillRectangle(tint, args.AffectedBounds);
    }

    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs args)
    {
        if (args.Item.Tag is MenuNode node && node.Type == "placeholder")
        {
            TextRenderer.DrawText(args.Graphics, args.Text, args.TextFont, args.TextRectangle, Color.Goldenrod, args.TextFormat);
            return;
        }
        base.OnRenderItemText(args);
    }
}
