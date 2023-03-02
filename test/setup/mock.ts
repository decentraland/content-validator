import { createConfigComponent } from '@well-known-components/env-config-provider'
import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import {
  ContentValidatorComponents,
  ExternalCalls,
  QueryGraph,
  SubGraphs,
  ValidateFn,
  V1andV2collectionAssetValidateFn,
  ThirdPartyAssetValidateFn
} from '../../src/types'

export const buildLogger = (): ILoggerComponent => ({
  getLogger: () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    log() {}
  })
})

export function buildComponents(components?: Partial<ContentValidatorComponents>): ContentValidatorComponents {
  const config = components?.config ?? buildConfig({})

  const externalCalls = components?.externalCalls ?? buildExternalCalls()

  const logs = components?.logs ?? buildLogger()

  const accessChecker = {
    checkAccess: jest.fn() as jest.MockedFunction<ValidateFn>
  }
  return {
    config,
    logs,
    externalCalls,
    accessChecker,
    v1andV2collectionAssetValidateFn: jest.fn() as jest.MockedFunction<V1andV2collectionAssetValidateFn>,
    thirdPartyAssetValidateFn: jest.fn() as jest.MockedFunction<ThirdPartyAssetValidateFn>
  }
}

export function buildConfig(optionMap: Partial<Record<string, string>>): IConfigComponent {
  return createConfigComponent({ ...optionMap })
}

export function buildExternalCalls(externalCalls?: Partial<ExternalCalls>): ExternalCalls {
  return {
    isContentStoredAlready: () => Promise.resolve(new Map()),
    fetchContentFileSize: () => Promise.resolve(undefined),
    validateSignature: () => Promise.resolve({ ok: true }),
    ownerAddress: () => '',
    isAddressOwnedByDecentraland: () => false,
    ...externalCalls
  }
}

export const createMockSubgraphComponent = (mock?: QueryGraph): ISubgraphComponent => ({
  query: mock ?? (jest.fn() as jest.MockedFunction<QueryGraph>)
})
