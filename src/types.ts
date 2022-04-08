import { ILoggerComponent } from '@well-known-components/interfaces'
import { AuditInfo, ContentFileHash, Entity, EntityId, Fetcher } from 'dcl-catalyst-commons'

/**
 * @public
 */
export type LocalDeploymentAuditInfo = Pick<AuditInfo, 'authChain'>

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
  files: Map<ContentFileHash, Uint8Array>
  auditInfo: LocalDeploymentAuditInfo
}

/**
 * External calls interface to be provided by the servers.
 * @public
 */
export type ExternalCalls = {
  isContentStoredAlready: (hashes: ContentFileHash[]) => Promise<Map<ContentFileHash, boolean>>
  fetchContentFileSize: (hash: string) => Promise<number | undefined>
  validateSignature: (
    entityId: EntityId,
    auditInfo: LocalDeploymentAuditInfo,
    timestamp: number
  ) => Promise<{ ok: boolean; message?: string }>
  ownerAddress: (auditInfo: LocalDeploymentAuditInfo) => string
  isAddressOwnedByDecentraland: (address: string) => boolean
  queryGraph: Fetcher['queryGraph']
  subgraphs: {
    L1: {
      landManager: string
      blocks: string
      collections: string
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
  externalCalls: ExternalCalls
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
  validate: (args: ValidationArgs, logs?: ILoggerComponent.ILogger) => ValidationResponse | Promise<ValidationResponse>
}

/**
 * @public
 */
export type ConditionalValidation = {
  predicate: (args: ValidationArgs) => boolean | Promise<boolean>
  message: (args: ValidationArgs) => string
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
  errors: error,
})

/**
 * @public
 */
export const conditionalValidation = (condition: ConditionalValidation): Validation => ({
  validate: async (args) => {
    if (!(await condition.predicate(args))) {
      return validationFailed(condition.message(args))
    }
    return OK
  },
})

/**
 * @public
 */
export const fromErrors = (...errors: Errors): ValidationResponse => ({
  ok: errors.length === 0,
  errors: errors.length > 0 ? errors : undefined,
})

/**
 * Components that can be used to validate deployments.
 * @public
 */
export type ContentValidatorComponents = {
  logs: ILoggerComponent
}
