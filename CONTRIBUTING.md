# Contributing plugins

Thank you so much for your interest in contributing!

To add a plugin, add a folder under `plugins/` and submit a pull request. Include source, `plugin.json`, `README.md`, `LICENSE`, and a project file in the plugin folder. Add the project directly to `Plugins.slnx`:

 - `.esproj` for JavaScript/TypeScript, 
 - `.vcxproj` for C/C++, or 
 - `.csproj` for C#. 

Keep the displayed README focused on what the plugin does, and its settings and limitations. It's designed to show up in the plugin UI, so don't include build instructions there.

## Review policy

- Executable code must be available for review. Do not commit compiled binaries.
- Plugins must not download and execute external code, including scripts, programs, native libraries, managed assemblies and WASM. Fetching ordinary data is allowed. There may be exceptions to this rule.
- Executable dependencies must be included as source or pinned and built through CI. Include their licenses and notices in the package.
- Describe substantial permissions, filesystem changes, network activity and process modifications in the README.
- Preserve original authorship and licensing when adapting existing code. Credit does not replace permission under its license.

## Plugin manifest

For a JavaScript plugin that runs in Discord's interface, `plugin.json` looks like this:

```json
{
    "manifestVersion": 3,
    "id": "example-author.selectable-settings",
    "name": "Selectable Settings",
    "version": "1.0.0",
    "description": "Select and copy text throughout Discord settings.",
    "entrypoints": {
        "renderer": {
            "runtime": "javascript",
            "path": "renderer.js",
            "requiresApi": "1.0.0"
        }
    },
    "readme": "README.md",
    "license": "MIT"
}
```

- Choose a unique `id` and keep it unchanged between releases. `name` and `description` appear in the plugin list.
- `version` is the plugin's semantic version. `manifestVersion` identifies the manifest format, not the plugin or API version.
- `renderer` runs in Discord's interface. Use `main` with a path such as `main.js` for Electron's main process, or declare both if the plugin needs both.
- Each entry point declares its runtime and a path relative to the installed plugin folder. For JavaScript, `requiresApi` declares the Bedrock API version the plugin needs.
- `readme` identifies the Markdown file shown in the plugin details. `license` identifies the plugin's license; include the full text in `LICENSE`.

For desktop C# plugins, use `"runtime": "dotnet"` on the main entry point and reference `Managed/Desktop/Bedrock.Desktop.csproj` from the SDK. Browser C# entry points use `"runtime": "dotnet-wasm"` in the renderer. Both declare the entry class and API requirement in an assembly-level `BedrockPlugin` attribute.

For a native plugin, use `"runtime": "native"` and the packaged DLL path. [backdrop-blur-fix](plugins/backdrop-blur-fix) is a good reference to use to help you set up a native plugin, as I haven't yet documented the process  of creating one fully.

## Packaging

`plugin.json` describes the installed plugin. Its project declares which files ship and imports the shared `tools/Plugin.targets`:

```xml
<Target Name="DeclarePluginFiles" BeforeTargets="PackagePlugin">
  <ItemGroup>
    <PluginFile Include="plugin.json;README.md;LICENSE;main.js" />
    <PluginFile Include="$(TargetPath)">
      <PackagePath>native\win32-x64\example.node</PackagePath>
    </PluginFile>
  </ItemGroup>
</Target>
<Import Project="..\..\tools\Plugin.targets" />
```

 - `PackagePath` defaults to the source filename. Set it when a file belongs in a subfolder or needs another name. 
 - Include dependency notices as `PluginFile` items too
 - SDK files are available through `BedrockSdkRoot`

Declarations run after building so generated paths such as `TargetPath` are available. Plain JavaScript projects omit the native output item and disable npm installation and build scripts. TypeScript projects can enable their build script.

The collection script invokes `PackagePlugin`, which builds the project and copies its declared files into `.artifacts/packages`. It then validates that folder, creates its ZIP and adds it to the catalog. Projects can also invoke `PackagePlugin` directly through MSBuild.

Increment the plugin version when changing a published package. CI rejects changing an already published version to different package contents. Changing `sdk.json` requires review, just like changing a dependency.