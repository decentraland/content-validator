import { EntityType } from '@dcl/schemas'
import { SubgraphAccessCheckerComponents, ValidateFn } from '../../types'
import { createEmoteValidateFn } from './emotes'
import { createProfileValidateFn } from './profiles'
import { createSceneValidateFn } from './scenes'
import { createStoreValidateFn } from './stores'
import { createWearableValidateFn } from './wearables'

export function createSubgraphAccessCheckValidateFns(
  components: SubgraphAccessCheckerComponents
): Record<EntityType, ValidateFn> {
  return {
    [EntityType.PROFILE]: createProfileValidateFn(components),
    [EntityType.SCENE]: createSceneValidateFn(components),
    [EntityType.WEARABLE]: createWearableValidateFn(components),
    [EntityType.STORE]: createStoreValidateFn(components),
    [EntityType.EMOTE]: createEmoteValidateFn(components)
  }
}
