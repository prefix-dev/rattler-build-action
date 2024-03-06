import path from 'path'
import os from 'os'
import { exit } from 'process'
import * as core from '@actions/core'
import * as z from 'zod'
import untildify from 'untildify'

type Inputs = Readonly<{
  rattlerBuildVersion?: string
  rattlerBuildUrl?: string
  logLevel?: LogLevel
  rattlerBuildBinPath?: string
  authHost?: string
  authToken?: string
  authUsername?: string
  authPassword?: string
  authCondaToken?: string
  postCleanup?: boolean
}>

export type RattlerBuildSource =
  | {
      version: string
    }
  | {
      url: string
    }

type Auth = {
  host: string
} & (
  | {
      token: string
    }
  | {
      username: string
      password: string
    }
  | {
      condaToken: string
    }
)

export type Options = Readonly<{
  rattlerBuildSource: RattlerBuildSource
  logLevel: LogLevel
  rattlerBuildBinPath: string
  auth?: Auth
  postCleanup: boolean
}>

const logLevelSchema = z.enum(['q', 'default', 'v', 'vv', 'vvv'])
export type LogLevel = z.infer<typeof logLevelSchema>

export const PATHS = {
  rattlerBuildBin: path.join(
    os.homedir(),
    '.rattler-build',
    'bin',
    `rattler-build${os.platform() === 'win32' ? '.exe' : ''}`
  )
}

const parseOrUndefined = <T>(key: string, schema: z.ZodSchema<T>, errorMessage?: string): T | undefined => {
  const input = core.getInput(key)
  // GitHub actions sets empty inputs to the empty string, but we want undefined
  if (input === '') {
    return undefined
  }
  const maybeResult = schema.safeParse(input)
  if (!maybeResult.success) {
    if (!errorMessage) {
      throw new Error(`${key} is not valid: ${maybeResult.error.message}`)
    }
    throw new Error(errorMessage)
  }
  return maybeResult.data
}

const parseOrUndefinedJSON = <T>(key: string, schema: z.ZodSchema<T>): T | undefined => {
  const input = core.getInput(key)
  // GitHub actions sets empty inputs to the empty string, but we want undefined
  if (input === '') {
    return undefined
  }
  return schema.parse(JSON.parse(input))
}

const validateInputs = (inputs: Inputs): void => {
  if (inputs.rattlerBuildVersion && inputs.rattlerBuildUrl) {
    throw new Error('You need to specify either rattler-build-version or rattler-build-url')
  }
  if ((inputs.authUsername && !inputs.authPassword) || (!inputs.authUsername && inputs.authPassword)) {
    throw new Error('You need to specify both auth-username and auth-password')
  }
  // now we can assume that authUsername is defined iff authPassword is defined
  if (inputs.authHost) {
    if (!inputs.authToken && !inputs.authUsername && !inputs.authCondaToken) {
      throw new Error('You need to specify either auth-token or auth-username and auth-password or auth-conda-token')
    }
    if (
      (inputs.authToken && (inputs.authUsername || inputs.authCondaToken)) ||
      (inputs.authUsername && inputs.authCondaToken)
    ) {
      throw new Error('You cannot specify two auth methods')
    }
  }
  if (!inputs.authHost) {
    if (inputs.authToken || inputs.authUsername || inputs.authCondaToken) {
      throw new Error('You need to specify auth-host')
    }
  }
}

const inferOptions = (inputs: Inputs): Options => {
  const rattlerBuildSource = inputs.rattlerBuildVersion
    ? { version: inputs.rattlerBuildVersion }
    : inputs.rattlerBuildUrl
      ? { url: inputs.rattlerBuildUrl }
      : { version: 'latest' }
  const logLevel = inputs.logLevel ?? (core.isDebug() ? 'vv' : 'default')
  const rattlerBuildBinPath = inputs.rattlerBuildBinPath
    ? path.resolve(untildify(inputs.rattlerBuildBinPath))
    : PATHS.rattlerBuildBin
  const auth = !inputs.authHost
    ? undefined
    : ((inputs.authToken
        ? {
            host: inputs.authHost,
            token: inputs.authToken
          }
        : inputs.authCondaToken
          ? {
              host: inputs.authHost,
              condaToken: inputs.authCondaToken
            }
          : {
              host: inputs.authHost,
              username: inputs.authUsername!,
              password: inputs.authPassword!
            }) as Auth)
  const postCleanup = inputs.postCleanup ?? true
  return {
    rattlerBuildSource,
    logLevel,
    rattlerBuildBinPath,
    auth,
    postCleanup
  }
}

const assertOptions = (_options: Options) => {
  // const assert = (condition: boolean, message?: string) => {
  //   if (!condition) {
  //     throw new Error(message)
  //   }
  // }
  // TODO
}

const getOptions = () => {
  const inputs: Inputs = {
    rattlerBuildVersion: parseOrUndefined(
      'rattler-build-version',
      z.union([z.literal('latest'), z.string().regex(/^v\d+\.\d+\.\d+$/)]),
      'pixi-version must either be `latest` or a version string matching `vX.Y.Z`.'
    ),
    rattlerBuildUrl: parseOrUndefined('rattler-build-url', z.string().url()),
    logLevel: parseOrUndefined(
      'log-level',
      logLevelSchema,
      'log-level must be one of `q`, `default`, `v`, `vv`, `vvv`.'
    ),
    rattlerBuildBinPath: parseOrUndefined('rattler-build-bin-path', z.string()),
    authHost: parseOrUndefined('auth-host', z.string()),
    authToken: parseOrUndefined('auth-token', z.string()),
    authUsername: parseOrUndefined('auth-username', z.string()),
    authPassword: parseOrUndefined('auth-password', z.string()),
    authCondaToken: parseOrUndefined('auth-conda-token', z.string()),
    postCleanup: parseOrUndefinedJSON('post-cleanup', z.boolean())
  }
  core.debug(`Inputs: ${JSON.stringify(inputs)}`)
  validateInputs(inputs)
  const options = inferOptions(inputs)
  core.debug(`Inferred options: ${JSON.stringify(options)}`)
  assertOptions(options)
  return options
}

let _options: Options
try {
  _options = getOptions()
} catch (error) {
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
}

export const options = _options
