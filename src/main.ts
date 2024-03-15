import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { exit } from 'process'
import * as core from '@actions/core'
import { downloadTool } from '@actions/tool-cache'
import type { RattlerBuildSource } from './options'
import { options } from './options'
import { execute, getRattlerBuildUrlFromVersion, rattlerBuildCmd } from './util'

const downloadRattlerBuild = (source: RattlerBuildSource) => {
  const url = 'version' in source ? getRattlerBuildUrlFromVersion(source.version) : source.url
  return core.group('Downloading rattler-build', () => {
    core.debug('Installing rattler-build')
    core.debug(`Downloading rattler-build from ${url}`)
    return fs
      .mkdir(path.dirname(options.rattlerBuildBinPath), { recursive: true })
      .then(() => downloadTool(url, options.rattlerBuildBinPath))
      .then((_downloadPath) => fs.chmod(options.rattlerBuildBinPath, 0o755))
      .then(() => core.info(`rattler-build installed to ${options.rattlerBuildBinPath}`))
  })
}

const rattlerBuildLogin = () => {
  const auth = options.auth
  if (!auth) {
    core.debug('Skipping rattler-build login.')
    return Promise.resolve(0)
  }
  core.debug(`auth keys: ${Object.keys(auth)}`)
  return core.group('Logging in to private channel', () => {
    // tokens get censored in the logs as long as they are a github secret
    if ('token' in auth) {
      core.debug(`Logging in to ${auth.host} with token`)
      return execute(rattlerBuildCmd(`auth login --token ${auth.token} ${auth.host}`))
    }
    if ('username' in auth) {
      core.debug(`Logging in to ${auth.host} with username and password`)
      return execute(rattlerBuildCmd(`auth login --username ${auth.username} --password ${auth.password} ${auth.host}`))
    }
    core.debug(`Logging in to ${auth.host} with conda token`)
    return execute(rattlerBuildCmd(`auth login --conda-token ${auth.condaToken} ${auth.host}`))
  })
}

const addRattlerBuildToPath = () => {
  core.addPath(path.dirname(options.rattlerBuildBinPath))
}

const run = async () => {
  core.debug(`process.env.HOME: ${process.env.HOME}`)
  core.debug(`os.homedir(): ${os.homedir()}`)
  await downloadRattlerBuild(options.rattlerBuildSource)
  addRattlerBuildToPath()
  await rattlerBuildLogin()
}

run().catch((error) => {
  if (core.isDebug()) {
    throw error
  }
  if (error instanceof Error) {
    core.setFailed(error.message)
    exit(1)
  } else if (typeof error === 'string') {
    core.setFailed(error)
    exit(1)
  }
  throw error
})
