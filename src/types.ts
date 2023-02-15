import { AuthChain, Entity, EthAddress } from '@dcl/schemas'
import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent, Variables } from '@well-known-components/thegraph-component'
import { PermissionResult } from './the-graph-client/the-graph-client'
import { BlockSearch } from '@dcl/block-indexer'

/**
 * @public
 */
export type LocalDeploymentAuditInfo = { authChain: AuthChain }

/**
 * @public
 */
export type Errors = string[]

/**
 * @public
 */
export type Warnings = string[]

/**
 * @public
 */
export type EntityWithEthAddress = Entity & {
  ethAddress: string
}

/**
 * Deployment object to be validated by the validator.
 * @public
 */
export type DeploymentToValidate = {
  entity: Entity
  files: Map<string, Uint8Array>
  auditInfo: LocalDeploymentAuditInfo
}

/**
 * Function used to fetch TheGraph
 * @public
 */
export type QueryGraph = <T = any>(query: string, variables?: Variables, remainingAttempts?: number) => Promise<T>

/**
 * External calls interface to be provided by the servers.
 * @public
 */
export type ExternalCalls = {
  isContentStoredAlready: (hashes: string[]) => Promise<Map<string, boolean>>
  fetchContentFileSize: (hash: string) => Promise<number | undefined>
  validateSignature: (
    entityId: string,
    auditInfo: LocalDeploymentAuditInfo,
    timestamp: number
  ) => Promise<{ ok: boolean; message?: string }>
  ownerAddress: (auditInfo: LocalDeploymentAuditInfo) => string
  isAddressOwnedByDecentraland: (address: string) => boolean
}

/**
 * Validator interface to be used by any server.
 * @public
 */
export interface Validator {
  validate(deployment: DeploymentToValidate): Promise<ValidationResponse>
}

/**
 * @public
 */
export type ValidationArgs = {
  deployment: DeploymentToValidate
}

/**
 * @public
 */
export type ValidationResponse = {
  ok: boolean
  errors?: Errors
}

/**
 * @public
 */
export type Validation = {
  validate: (
    components: ContentValidatorComponents,
    deployment: DeploymentToValidate
  ) => ValidationResponse | Promise<ValidationResponse>
}

/**
 * @public
 */
export type ConditionalValidation = {
  predicate: (
    components: ContentValidatorComponents,
    deployment: DeploymentToValidate
  ) => ValidationResponse | Promise<ValidationResponse>
}

/**
 * @public
 */
export const OK: ValidationResponse = { ok: true }

/**
 * @public
 */
export const validationFailed = (...error: string[]): ValidationResponse => ({
  ok: false,
  errors: error
})

/**
 * @public
 */
export const fromErrors = (...errors: Errors): ValidationResponse => ({
  ok: errors.length === 0,
  errors: errors.length > 0 ? errors : undefined
})

/**
 * @public
 */
export type L1Checker = {
  checkLAND(ethAddress: string, parcels: [number, number][], block: number): Promise<boolean[]>
  checkNames(ethAddress: string, names: string[], block: number): Promise<boolean[]>
}

/**
 * @public
 */
export type L2Checker = {
  validateWearables(
    ethAddress: string,
    contractAddress: string,
    assetId: string,
    hashes: string[],
    block: number
  ): Promise<boolean>

  validateThirdParty(tpId: string, root: Buffer, block: number): Promise<boolean>
}

/**
 * A list with all sub-graphs used for validations.
 * @public
 */
export type SubGraphs = {
  L1: {
    checker: L1Checker
    collections: ISubgraphComponent
  }
  L2: {
    checker: L2Checker
    collections: ISubgraphComponent
  }
  l1BlockSearch: BlockSearch
  l2BlockSearch: BlockSearch
}

/**
 * @public
 */
export type TheGraphClient = {
  ownsNamesAtTimestamp: (ethAddress: EthAddress, namesToCheck: string[], timestamp: number) => Promise<PermissionResult>

  ownsItemsAtTimestamp: (ethAddress: EthAddress, urnsToCheck: string[], timestamp: number) => Promise<PermissionResult>

  findBlocksForTimestamp: (timestamp: number, blockSearch: BlockSearch) => Promise<BlockInformation>
}

/**
 * @public
 */
export type BlockInformation = {
  blockAtDeployment: number | undefined
  blockFiveMinBeforeDeployment: number | undefined
}

/**
 * Components that can be used to validate deployments.
 * @public
 */
export type ContentValidatorComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  theGraphClient: TheGraphClient
  externalCalls: ExternalCalls
  subGraphs: SubGraphs
}
