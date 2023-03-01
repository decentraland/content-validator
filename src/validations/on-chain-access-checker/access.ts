import { EntityType } from '@dcl/schemas'
import { OK, DeploymentToValidate, OnChainAccessCheckerComponents, ValidateFn } from '../../types'
import { createEmoteValidateFn } from './emotes'
import { createProfileValidateFn } from './profiles'
import { createSceneValidateFn } from './scenes'
import { createWearableValidateFn } from './wearables'

export function createOnChainAccessCheckValidateFns(
  components: OnChainAccessCheckerComponents
): Record<EntityType, ValidateFn> {
  return {
    [EntityType.PROFILE]: createProfileValidateFn(components),
    [EntityType.SCENE]: createSceneValidateFn(components),
    [EntityType.WEARABLE]: createWearableValidateFn(components),
    [EntityType.STORE]: async (_d: DeploymentToValidate) => OK,
    [EntityType.EMOTE]: createEmoteValidateFn(components)
  }
}
