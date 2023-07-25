import { BlockSearch } from '@dcl/block-indexer'
import { AuthChain, Entity, EthAddress } from '@dcl/schemas'
import {
  BlockchainCollectionThirdParty,
  BlockchainCollectionV1Asset,
  BlockchainCollectionV2Asset
} from '@dcl/urn-resolver'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import { PermissionResult } from './validations/access/subgraph/the-graph-client'

export const L1_NETWORKS = ['mainnet', 'kovan', 'rinkeby', 'goerli', 'sepolia']
export const L2_NETWORKS = ['matic', 'mumbai']

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

export type NamesOwnership = {
  ownsNamesAtTimestamp: (ethAddress: EthAddress, namesToCheck: string[], timestamp: number) => Promise<PermissionResult>
}

export type ItemsOwnership = {
  ownsItemsAtTimestamp: (ethAddress: EthAddress, urnsToCheck: string[], timestamp: number) => Promise<PermissionResult>
}

/**
 * @public
 */
export type TheGraphClient = NamesOwnership &
  ItemsOwnership & {
    findBlocksForTimestamp: (subgraph: ISubgraphComponent, timestamp: number) => Promise<BlockInformation>
  }

/**
 * @public
 */
export type OnChainClient = NamesOwnership &
  ItemsOwnership & {
    findBlocksForTimestamp: (timestamp: number, blockSearch: BlockSearch) => Promise<BlockInformation>
  }

/**
 * @public
 */
export type BlockInformation = {
  blockNumberAtDeployment: number | undefined
  blockNumberFiveMinBeforeDeployment: number | undefined
}

/**
 * Components that can be used to validate deployments.
 * @public
 */
export type ContentValidatorComponents = {
  logs: ILoggerComponent
  externalCalls: ExternalCalls
  accessValidateFn: ValidateFn
}

/**
 * @public
 */
export type SubgraphAccessCheckerComponents = Pick<ContentValidatorComponents, 'logs' | 'externalCalls'> & {
  theGraphClient: TheGraphClient
  subGraphs: SubGraphs
  tokenAddresses: TokenAddresses
}

/**
 * Required Smart Contract addresses.
 * @public
 */
export type TokenAddresses = {
  estate: EthAddress
  land: EthAddress
}

/**
 * @public
 */
export type OnChainAccessCheckerComponents = Pick<ContentValidatorComponents, 'logs' | 'externalCalls'> & {
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

/**
 * @internal
 */
export type V1andV2collectionAssetValidateFn = (
  asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
  deployment: DeploymentToValidate
) => Promise<ValidationResponse>

/**
 * @internal
 */
export type ThirdPartyAssetValidateFn = (
  asset: BlockchainCollectionThirdParty,
  deployment: DeploymentToValidate
) => Promise<ValidationResponse>
