import { AuthChain, Entity, EthAddress } from '@dcl/schemas'
import { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent, Variables } from '@well-known-components/thegraph-component'
import { PermissionResult } from './validations/subgraph-access-checker/the-graph-client'
import { BlockSearch } from '@dcl/block-indexer'
import {
  BlockchainCollectionThirdParty,
  BlockchainCollectionV1Asset,
  BlockchainCollectionV2Asset
} from '@dcl/urn-resolver'

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
export type ValidateFn = (deployment: DeploymentToValidate) => Promise<ValidationResponse>

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
    landManager: ISubgraphComponent
    blocks: ISubgraphComponent
    collections: ISubgraphComponent
    ensOwner: ISubgraphComponent
  }
  L2: {
    blocks: ISubgraphComponent
    collections: ISubgraphComponent
    thirdPartyRegistry: ISubgraphComponent
  }
}

/**
 * @public
 */
export type TheGraphClient = {
  ownsNamesAtTimestamp: (ethAddress: EthAddress, namesToCheck: string[], timestamp: number) => Promise<PermissionResult>

  ownsItemsAtTimestamp: (ethAddress: EthAddress, urnsToCheck: string[], timestamp: number) => Promise<PermissionResult>

  findBlocksForTimestamp: (subgraph: ISubgraphComponent, timestamp: number) => Promise<BlockInformation>
}

/**
 * @public
 */
export type OnChainClient = {
  ownsNamesAtTimestamp: (ethAddress: EthAddress, namesToCheck: string[], timestamp: number) => Promise<PermissionResult>

  ownsItemsAtTimestamp: (ethAddress: EthAddress, urnsToCheck: string[], timestamp: number) => Promise<PermissionResult>

  findBlocksForTimestamp: (timestamp: number, blockSearch: BlockSearch) => Promise<BlockInformation>
}

/**
 * @public
 */
export type BlockInformation = {
  blockNumberAtDeployment: number | undefined
  blockNumberFiveMinBeforeDeployment: number | undefined
}

export type AccessCheckerComponent = {
  checkAccess(deployment: DeploymentToValidate): Promise<ValidationResponse>
}

/**
 * Components that can be used to validate deployments.
 * @public
 */
export type ContentValidatorComponents = {
  config: IConfigComponent
  logs: ILoggerComponent
  externalCalls: ExternalCalls
  accessChecker: AccessCheckerComponent
  v1andV2collectionAssetValidateFn: V1andV2collectionAssetValidateFn
  thirdPartyAssetValidateFn: ThirdPartyAssetValidateFn
}

export type SubgraphAccessCheckerComponents = ContentValidatorComponents & {
  theGraphClient: TheGraphClient
  subGraphs: SubGraphs
}

export type OnChainAccessCheckerComponents = ContentValidatorComponents & {
  client: OnChainClient
  L1: {
    checker: L1Checker
    collections: ISubgraphComponent
    blockSearch: BlockSearch
  }
  L2: {
    checker: L2Checker
    collections: ISubgraphComponent
    blockSearch: BlockSearch
  }
}

export type V1andV2collectionAssetValidateFn = (
  asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
  deployment: DeploymentToValidate
) => Promise<ValidationResponse>

export type ThirdPartyAssetValidateFn = (
  asset: BlockchainCollectionThirdParty,
  deployment: DeploymentToValidate
) => Promise<ValidationResponse>
