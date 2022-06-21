import { AuthChain, Entity, EthAddress, WearableId } from '@dcl/schemas'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { PermissionResult } from './the-graph-client/the-graph-client'

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
export type QueryGraph = <T = any>(url: string, query: string, variables: Record<string, any>) => Promise<T>

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
  queryGraph: QueryGraph
  subgraphs: {
    L1: {
      landManager: string
      blocks: string
      collections: string
      ensOwner: string
    }
    L2: {
      blocks: string
      collections: string
      thirdPartyRegistry: string
    }
  }
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
export const conditionalValidation = (condition: ConditionalValidation): Validation => ({
  validate: async (components: ContentValidatorComponents, deployment: DeploymentToValidate) => {
    try {
      return await condition.predicate(components, deployment)
      //     ^^^^^ never remove this await, it exists to ensure try {} catch
    } catch (err: any) {
      return validationFailed(`Validation failed: ${err}`)
    }
  }
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
export type URLs = {
  ensSubgraph: string
  blocksSubgraph: string
  maticBlocksSubgraph: string
  collectionsSubgraph: string
  maticCollectionsSubgraph: string
}

/**
 * @public
 */
export type TheGraphClient = {
  checkForNamesOwnershipWithTimestamp: (
    ethAddress: EthAddress,
    namesToCheck: string[],
    timestamp: number
  ) => Promise<PermissionResult>

  checkForWearablesOwnershipWithTimestamp: (
    ethAddress: EthAddress,
    wearableIdsToCheck: WearableId[],
    timestamp: number
  ) => Promise<PermissionResult>

  findBlocksForTimestamp: (subgraph: keyof URLs, timestamp: number) => Promise<BlockInformation>
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
  theGraphClient: TheGraphClient
  externalCalls: ExternalCalls
}
