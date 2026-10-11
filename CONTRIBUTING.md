# Contributing plugins

Thank you so much for your interest in contributing!

To add a plugin, add a folder under `plugins/` and submit a pull request. Include source, `plugin.json`, `README.md`, `LICENSE`, `build.json`, and a project file in the plugin folder. Add the project directly to `Plugins.slnx`:

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

## Packaging

`plugin.json` describes the installed plugin. `build.json` describes how this repository produces that package:

```json
{
  "project": "Example.vcxproj",
  "files": {
    "plugin.json": "plugin.json",
    "README.md": "README.md",
    "LICENSE": "LICENSE",
    "main.js": "main.js",
    "src/bin/x64/Release/example.node": "native/win32-x64/example.node"
  }
}
```

`project` is required for every plugin. Plain JavaScript projects disable npm installation and build scripts; they need no compilation. TypeScript projects can enable their build script. Paths on the left are source files inside the plugin folder; paths on the right are their installed locations. `sdkNotices` can additionally map SDK license files to package locations. Use the pinned SDK through `BedrockSdkRoot` in native projects.

Increment the plugin version when changing a published package. CI rejects changing an already published version to different package contents. Changing `sdk.json` requires review, just like changing a dependency.
