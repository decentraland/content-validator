import { EntityType } from '@dcl/schemas'
import { OnChainAccessCheckerComponents, ValidateFn } from '../../types'
import { createEmoteValidateFn, createWearableValidateFn } from '../access/items'
import { createStoreValidateFn } from '../access/stores'
import { createProfileValidateFn } from './profiles'
import { createSceneValidateFn } from './scenes'

export function createOnChainAccessCheckValidateFns(
  components: OnChainAccessCheckerComponents
): Record<EntityType, ValidateFn> {
  return {
    [EntityType.PROFILE]: createProfileValidateFn(components),
    [EntityType.SCENE]: createSceneValidateFn(components),
    [EntityType.WEARABLE]: createWearableValidateFn(components),
    [EntityType.STORE]: createStoreValidateFn(components),
    [EntityType.EMOTE]: createEmoteValidateFn(components)
  }
}
