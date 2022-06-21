import { Emote, Entity, EntityType, ThirdPartyProps, Wearable } from '@dcl/schemas'
import { DeploymentToValidate, LocalDeploymentAuditInfo } from '../../src/types'
import {
  buildEmoteEntity,
  buildEntity,
  buildProfileEntity,
  buildSceneEntity,
  buildWearableEntity
} from './entity'

export const buildAuditInfo = (
  auditInfo?: Partial<LocalDeploymentAuditInfo>
): LocalDeploymentAuditInfo => ({
  authChain: [],
  ...auditInfo
})

export const buildStoreDeployment = (
  pointers: string[]
): DeploymentToValidate => {
  const entity = buildEntity({ type: EntityType.STORE, pointers })
  const files = new Map()
  const auditInfo = buildAuditInfo()

  return { entity, files, auditInfo }
}

export const buildProfileDeployment = (
  pointers: string[]
): DeploymentToValidate => ({
  entity: buildProfileEntity({
    pointers,
    metadata: {
      avatars: []
    }
  }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildSceneDeployment = (
  pointers: string[]
): DeploymentToValidate => ({
  entity: buildSceneEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildWearableDeployment = (
  pointers: string[]
): DeploymentToValidate => ({
  entity: buildWearableEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildThirdPartyWearableDeployment = (
  urn: string,
  metadata: Wearable & ThirdPartyProps
): DeploymentToValidate => ({
  entity: buildWearableEntity({ pointers: [urn], metadata }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildEmoteDeployment = (
  pointers: string[]
): DeploymentToValidate => ({
  entity: buildEmoteEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildThirdPartyEmoteDeployment = (
  urn: string,
  metadata: Emote & ThirdPartyProps
): DeploymentToValidate => ({
  entity: buildEmoteEntity({ pointers: [urn], metadata }),
  auditInfo: buildAuditInfo(),
  files: new Map()
})

export const buildDeployment = (args?: {
  entity?: Entity
  files?: Map<string, Uint8Array>
}): DeploymentToValidate => ({
  entity: args?.entity ?? buildEntity(),
  auditInfo: buildAuditInfo(),
  files: args?.files ?? new Map()
})
