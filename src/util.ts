import type { BinaryLike } from 'crypto'
import { createHash } from 'crypto'
import * as os from 'os'
import * as core from '@actions/core'
import { exec } from '@actions/exec'
import { options } from './options'

export const getCondaArch = () => {
  const archDict: Record<string, string> = {
    'darwin-x64': 'osx-64',
    'darwin-arm64': 'osx-arm64',
    'linux-x64': 'linux-64',
    'linux-arm64': 'linux-aarch64',
    'linux-ppc64': 'linux-ppc64le',
    'win32-x64': 'win-64'
  }
  const arch = archDict[`${os.platform()}-${os.arch()}`]
  if (!arch) {
    throw new Error(`Unsupported platform: ${os.platform()}-${os.arch()}`)
  }
  return arch
}

const getPlatform = () => {
  const platform = os.platform()
  switch (platform) {
    case 'darwin':
      return 'apple-darwin'
    case 'linux':
      return 'unknown-linux-musl'
    case 'win32':
      return 'pc-windows-msvc'
    default:
      throw new Error(`Unsupported architecture: ${platform}`)
  }
}

const getArch = () => {
  const arch = os.arch()
  switch (arch) {
    case 'x64':
      return 'x86_64'
    case 'arm64':
      return 'aarch64'
    default:
      throw new Error(`Unsupported architecture: ${arch}`)
  }
}

export const getRattlerBuildUrlFromVersion = (version: string) => {
  const arch = getArch()
  const platform = getPlatform()
  const rattlerBuildFile = `rattler-build-${arch}-${platform}${platform === 'pc-windows-msvc' ? '.exe' : ''}`
  if (arch === 'aarch64' && platform === 'pc-windows-msvc') {
    throw new Error('Windows on ARM is currently not supported')
  }
  if (version === 'latest') {
    return `https://github.com/prefix-dev/rattler-build/releases/latest/download/${rattlerBuildFile}`
  }
  return `https://github.com/prefix-dev/rattler-build/releases/download/${version}/${rattlerBuildFile}`
}

export const sha256 = (s: BinaryLike) => {
  return createHash('sha256').update(s).digest('hex')
}

export const sha256Short = (s: BinaryLike) => {
  return sha256(s).slice(0, 7)
}

export const execute = (cmd: string[]) => {
  core.debug(`Executing: ${cmd.join(' ')}`)
  return exec(cmd[0], cmd.slice(1))
}

export const rattlerBuildCmd = (command: string) => {
  let commandArray = [options.rattlerBuildBinPath].concat(command.split(' '))
  commandArray = commandArray.concat(['--color', 'always'])
  switch (options.logLevel) {
    case 'vvv':
      commandArray = commandArray.concat(['-vvv'])
      break
    case 'vv':
      commandArray = commandArray.concat(['-vv'])
      break
    case 'v':
      commandArray = commandArray.concat(['-v'])
      break
    case 'default':
      break
    case 'q':
      commandArray = commandArray.concat(['-q'])
      break
  }
  return commandArray
}
