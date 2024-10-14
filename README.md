<h1 align="center">

[![License][license-badge]][license]
[![CI][test-badge]][test]
[![Latest release][latest-release-badge]][releases]
[![Project Chat][chat-badge]][chat-url]

[license-badge]: https://img.shields.io/github/license/prefix-dev/rattler-build-action?style=flat-square
[license]: ./LICENSE
[test-badge]: https://img.shields.io/github/actions/workflow/status/prefix-dev/rattler-build-action/test.yml?style=flat-square
[test]: https://github.com/prefix-dev/rattler-build-action/actions/
[latest-release-badge]: https://img.shields.io/github/v/tag/prefix-dev/rattler-build-action?style=flat-square&label=latest&sort=semver
[releases]: https://github.com/prefix-dev/rattler-build-action/releases
[chat-badge]: https://img.shields.io/discord/1082332781146800168.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2&style=flat-square
[chat-url]: https://discord.gg/kKV8ZxyzY4

</h1>

# rattler-build-action 📦🐍

`rattler-build-action` is a GitHub Action for building conda packages using [rattler-build](https://github.com/prefix-dev/rattler-build).

## Usage

Create `.github/workflows/package.yml` in your repository. Here's a quick template:

```yml
name: Package

on: [push]

jobs:
  build:
    name: Build package
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build conda package
      uses: prefix-dev/rattler-build-action@v0.2.16
```

> [!WARNING]
> Since rattler-build is still experimental and the API can change in minor versions, please pin this action to its minor version, i.e., `prefix-dev/rattler-build-action@v0.2.16`.

> [!TIP]
> You can use dependabot to automatically update the version of `rattler-build-action`. Add the following to your `.github/dependabot.yml`:
>
> ```yml
> version: 2
> updates:
>   - package-ecosystem: github-actions
>     directory: /
>     schedule:
>       interval: monthly
>     groups:
>       gh-actions:
>         patterns:
>           - "*"
> ```

This action will build the conda recipe in `conda.recipe/recipe.yaml` and upload the built packages as a build artifact.

## Customizations

- `rattler-build-version`: Define the version of rattler-build. Pins to the latest version that is available when releasing.
- `recipe-path`: Path to the rattler recipe. Defaults to `conda.recipe/recipe.yaml`.
- `upload-artifact`: Decide whether to upload the built packages as a build artifact.
- `build-args`: Additional arguments to pass to `rattler-build build`.
- `artifact-name`: Name of the artifact that is uploaded after build. If running `rattler-build-action` multiple times in a matrix, you need a distinct name for each workflow.

### `rattler-build-version`

`rattler-build-version` is strictly pinned to the latest version of `rattler-build` that is available when releasing a new version of `rattler-build-action`.
This is to ensure that no breakages occur if a new version of `rattler-build` is released.

You can use dependabot to automatically update the version of `prefix-dev/rattler-build-action` which will also update the version of `rattler-build` to the latest version.

## Examples

### Build for multiple targets using matrix

```yml
jobs:
  build:
    name: Build package
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target-platform: linux-64
          - os: ubuntu-latest
            target-platform: linux-aarch64
          - os: windows-latest
            target-platform: win-64
          - os: macos-latest
            target-platform: osx-64
          - os: macos-14
            target-platform: osx-arm64
    steps:
    - uses: actions/checkout@v4
    - name: Build conda package
      uses: prefix-dev/rattler-build-action@v0.2.16
      with:
        # needs to be unique for each matrix entry
        artifact-name: package-${{ matrix.target-platform }}
        build-args: --target-platform ${{ matrix.target-platform }}${{ matrix.target-platform == 'linux-aarch64' && ' --no-test' || '' }}
```

### Upload to quetz

```yml
jobs:
  build:
    name: Build package
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build conda package
      uses: prefix-dev/rattler-build-action@v0.2.16
    - run: |
        for pkg in $(find output -type f \( -name "*.conda" -o -name "*.tar.bz2" \) ); do
          echo "Uploading ${pkg}"
          rattler-build upload quetz "${pkg}"
        done
      env:
        QUETZ_SERVER_URL: https://my.quetz.server
        QUETZ_API_KEY: ${{ secrets.QUETZ_API_KEY }}
        QUETZ_CHANNEL: my-channel
```

### Upload to prefix.dev

```yml
jobs:
  build:
    name: Build package
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Build conda package
      uses: prefix-dev/rattler-build-action@v0.2.16
    - run: |
        for pkg in $(find output -type f \( -name "*.conda" -o -name "*.tar.bz2" \) ); do
          echo "Uploading ${pkg}"
          rattler-build upload prefix -c my-channel "${pkg}"
        done
      env:
        PREFIX_API_KEY: ${{ secrets.PREFIX_API_KEY }}
```

### Use private channel

You can use a private channel while building your conda package by setting the `RATTLER_AUTH_FILE` environment variable.
As of now, `rattler-build` does not support a `login` command [prefix-dev/rattler-build#334](https://github.com/prefix-dev/rattler-build/issues/334), so you need to create the `RATTLER_AUTH_FILE` manually.

```yml
jobs:
  build:
    name: Build package
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Authenticate with private channel
      run: |
        RATTLER_AUTH_FILE=${{ runner.temp }}/credentials.json
        echo '{"my.quetz.server": {"CondaToken": "${{ secrets.QUETZ_API_KEY }}"}}' > "$RATTLER_AUTH_FILE"
        echo "RATTLER_AUTH_FILE=$RATTLER_AUTH_FILE" >> "$GITHUB_ENV"
    - name: Build conda package
      uses: prefix-dev/rattler-build-action@v0.2.16
      with:
        build-args: -c conda-forge -c https://my.quetz.server/get/my-channel
```
