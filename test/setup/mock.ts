import { ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent, Variables } from '@well-known-components/thegraph-component'
import { ContentValidatorComponents, ExternalCalls, ValidateFn } from '../../src/types'

export type QueryGraph = <T = any>(query: string, variables?: Variables, remainingAttempts?: number) => Promise<T>

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
  const externalCalls = components?.externalCalls ?? buildExternalCalls()

  const logs = components?.logs ?? buildLogger()

  return {
    logs,
    externalCalls,
    accessValidateFn: jest.fn() as jest.MockedFunction<ValidateFn>
  }
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
