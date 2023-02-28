import { EntityType } from '@dcl/schemas'
import { IConfigComponent } from '@well-known-components/interfaces'
import {
  AccessCheckerComponent,
  DeploymentToValidate,
  OK,
  SubgraphAccessCheckerComponents,
  ValidateFn,
  validationFailed,
  ValidationResponse,
} from '../../types'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '../timestamps'
import { validateAll } from '../validations'
import { createEmoteValidateFn } from './emotes'
import {
  createItemOwnershipValidateFn,
  createNamesOwnershipValidateFn,
  createPointerValidateFn,
  createProfileValidateFn,
} from './profiles'
import { createSceneValidateFn } from './scenes'
import { createStoreValidateFn } from './stores'
import { createWearableValidateFn } from './wearables'

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export async function createSubgraphAccessCheckerComponent(
  components: SubgraphAccessCheckerComponents
): Promise<AccessCheckerComponent> {
  const { config, externalCalls } = components

  if ((await config.getString('IGNORE_BLOCKCHAIN_ACCESS_CHECKS')) === 'true') {
    return { checkAccess: (_deployment: DeploymentToValidate) => Promise.resolve(OK) }
  }

  const accessCheckers: Record<EntityType, ValidateFn> = {
    [EntityType.PROFILE]: createProfileValidateFn(components),
    [EntityType.SCENE]: createSceneValidateFn(components),
    [EntityType.WEARABLE]: createWearableValidateFn(components),
    [EntityType.STORE]: createStoreValidateFn(components),
    [EntityType.EMOTE]: createEmoteValidateFn(components),
  }

  async function checkAccess(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const deployedBeforeDCLLaunch = deployment.entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP
    const address = externalCalls.ownerAddress(deployment.auditInfo)

    const isDefaultScene =
      deployment.entity.type === EntityType.SCENE &&
      deployment.entity.pointers.some((p) => p.toLowerCase().startsWith('default'))

    // Default scenes were removed from the Content Servers after https://github.com/decentraland/catalyst/issues/878
    if (isDefaultScene) {
      return validationFailed(
        `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45).`
      )
    }
    // Legacy entities still need to be synchronized
    if (deployedBeforeDCLLaunch && externalCalls.isAddressOwnedByDecentraland(address)) {
      return OK
    }

    return accessCheckers[deployment.entity.type](deployment)
  }

  return {
    checkAccess,
  }
}
