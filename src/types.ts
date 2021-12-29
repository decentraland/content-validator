import { AuditInfo, ContentFileHash, Entity, EntityId, EntityType, Fetcher } from "dcl-catalyst-commons"

export type LocalDeploymentAuditInfo = Pick<AuditInfo, "authChain" | "migrationData">

export type Errors = string[]

export type Warnings = string[]

export type EntityWithEthAddress = Entity & {
  ethAddress: string
}

export type DeploymentToValidate = {
  entity: Entity
  files: Map<ContentFileHash, Uint8Array>
  auditInfo: LocalDeploymentAuditInfo
  context: "LOCAL" | "SYNCED"
}

export type ExternalCalls = {
  areThereNewerEntities: (entity: Entity) => Promise<boolean>
  isFailedDeployment: (entityType: EntityType, entityId: EntityId) => Promise<boolean>
  isContentStoredAlready: (hashes: ContentFileHash[]) => Promise<Map<ContentFileHash, boolean>>
  isEntityDeployedAlready: () => Promise<boolean>
  isEntityRateLimited: (entity: Entity) => Promise<boolean>
  fetchContentFileSize: (hash: string) => Promise<number | undefined>
  validateSignature: (
    entityId: EntityId,
    auditInfo: LocalDeploymentAuditInfo,
    timestamp: number
  ) => Promise<{ ok: boolean; message?: string }>
  getMaxUploadSizePerTypeInMB: (entityType: EntityType) => number
  ownerAddress: (auditInfo: LocalDeploymentAuditInfo) => string
  hasAccess: (entityWithAddress: EntityWithEthAddress) => Promise<string[]>
  isAddressOwnedByDecentraland: (address: string) => Promise<boolean>
  requestTtlBackwards: number
  wearableSizeLimitInMB: number
  queryGraph: Fetcher["queryGraph"]
  subgraphs: {
    L1: {
      landManager: string
      blocks: string
      collections: string
    }
    L2: {
      blocks: string
      collections: string
    }
  }
}

export interface Validator {
  validate(deployment: DeploymentToValidate, calls: ExternalCalls): Promise<ValidationResponse>
}

export type ValidationArgs = {
  deployment: DeploymentToValidate
  externalCalls: ExternalCalls
}

export type ValidationResponse = {
  ok: boolean
  errors?: Errors
  warnings?: Warnings
}

export type Validation = {
  validate: (args: ValidationArgs) => ValidationResponse | Promise<ValidationResponse>
}

export type ConditionalValidation = {
  predicate: (args: ValidationArgs) => boolean | Promise<boolean>
  message: (args: ValidationArgs) => string
}
export const OK: ValidationResponse = { ok: true }

export const validationFailed = (...error: string[]): ValidationResponse => ({
  ok: false,
  errors: error,
})

export const conditionalValidation = (condition: ConditionalValidation): Validation => ({
  validate: async (args) => {
    if (await condition.predicate(args)) {
      return validationFailed(condition.message(args))
    }
    return OK
  },
})

export const fromErrors = (...errors: Errors): ValidationResponse => ({
  ok: errors.length > 0,
  errors: errors.length > 0 ? errors : undefined,
})
