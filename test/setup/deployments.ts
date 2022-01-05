import { Entity, EntityType } from 'dcl-catalyst-commons'
import { DeploymentToValidate, LocalDeploymentAuditInfo } from '../../src/types'
import { buildEntity, buildProfileEntity, buildSceneEntity, buildWearableEntity } from './entity'

export const buildAuditInfo = (auditInfo?: Partial<LocalDeploymentAuditInfo>): LocalDeploymentAuditInfo => ({
  authChain: [],
  ...auditInfo,
})

export const buildStoreDeployment = (pointers: string[]): DeploymentToValidate => {
  const entity = buildEntity({ type: EntityType.STORE, pointers })
  const files = new Map()
  const auditInfo = buildAuditInfo()
  const context = 'LOCAL'

  return { entity, files, auditInfo, context }
}

export const buildProfileDeployment = (pointers: string[]): DeploymentToValidate => ({
  entity: buildProfileEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map(),
  context: 'LOCAL',
})

export const buildSceneDeployment = (pointers: string[]): DeploymentToValidate => ({
  entity: buildSceneEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map(),
  context: 'LOCAL',
})

export const buildWearableDeployment = (pointers: string[]): DeploymentToValidate => ({
  entity: buildWearableEntity({ pointers }),
  auditInfo: buildAuditInfo(),
  files: new Map(),
  context: 'LOCAL',
})

export const buildDeployment = (args?: { entity?: Entity; files?: Map<string, Uint8Array> }): DeploymentToValidate => ({
  entity: args?.entity ?? buildEntity(),
  auditInfo: buildAuditInfo(),
  files: args?.files ?? new Map(),
  context: 'LOCAL',
})
