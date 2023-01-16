import { Entity, EntityType } from '@dcl/schemas'
import { ContentValidatorComponents, DeploymentToValidate, OK, ValidateFn, validationFailed } from '../../types'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '../timestamps'
import { emotes } from './emotes'
import { profiles } from './profiles'
import { scenes } from './scenes'
import { stores } from './stores'
import { wearables } from './wearables'

const accessCheckers: Record<EntityType, ValidateFn> = {
  [EntityType.PROFILE]: profiles,
  [EntityType.SCENE]: scenes,
  [EntityType.WEARABLE]: wearables,
  [EntityType.STORE]: stores,
  [EntityType.EMOTE]: emotes
}

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export async function access(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
  if ((await components.config.getString('IGNORE_BLOCKCHAIN_ACCESS_CHECKS')) === 'true') {
    return OK
  }

  const deployedBeforeDCLLaunch = deployment.entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP
  const address = components.externalCalls.ownerAddress(deployment.auditInfo)

  // Default scenes were removed from the Content Servers after https://github.com/decentraland/catalyst/issues/878
  if (isDefaultScene(deployment.entity)) {
    return validationFailed(
      `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45).`
    )
  }
  // Legacy entities still need to be synchronized
  if (deployedBeforeDCLLaunch && components.externalCalls.isAddressOwnedByDecentraland(address)) return OK

  return accessCheckers[deployment.entity.type](components, deployment)
}

function isDefaultScene(entity: Entity) {
  return entity.type === EntityType.SCENE && entity.pointers.some((p) => p.toLowerCase().startsWith('default'))
}
