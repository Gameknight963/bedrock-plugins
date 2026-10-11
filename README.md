# Bedrock plugins

The official plugin collection for [Bedrock](https://github.com/bedrock-client/Bedrock). Plugins are maintained here and packaged independently of the launcher.

Each plugin is licensed separately (see the `LICENSE` file in its folder). Repository tooling and collection documentation are licensed under MIT.

## Layout

- `plugins/` contains plugin source, manifests, READMEs, licenses and build definitions. Each plugin has one project, listed directly in `Plugins.slnx`.
- `tools/` builds packages and generates the catalog.
- `tests/` checks plugin behavior and packaging.
- `sdk.json` pins the Bedrock source revision used as the build SDK.

The Example plugin remains in Bedrock's `Examples` directory rather than the official collection.

## Build

 - JavaScript projects use the Visual Studio JavaScript SDK
 - C# projects require the .NET SDK version targeted by their project

Run `python tools/prepare_sdk.py` to fetch the pinned SDK. Then run `python tools/build.py` on Windows with Visual Studio's C++ build tools installed. Native packages currently target Windows x64. Projects currently use the v145 toolset, if that's an issue you can pass `--toolset v143` which selects the toolset used by CI. `--sdk PATH` uses an existing checkout at the pinned revision.

Packages appear in `.artifacts/packages`, ZIPs and `catalog.json` in `.artifacts/dist`. Each ZIP contains one plugin folder and includes its license and third-party notices. Build files and native source are excluded from packages.

Run packaging tests with `python -m unittest discover -s tests -p "test_*.py"`. Plugin behavior tests use `node --test tests/*.test.cjs` after preparing the SDK; Node 24 is required.

## Adding a plugin

See [CONTRIBUTING.md](CONTRIBUTING.md).