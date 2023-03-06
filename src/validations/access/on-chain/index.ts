import { EntityType } from '@dcl/schemas'
import { OnChainAccessCheckerComponents, ValidateFn } from '../../../types'
import { createEmoteValidateFn, createWearableValidateFn } from '../common/items'
import { createStoreValidateFn } from '../common/stores'
import { createV1andV2collectionAssetValidateFn } from './collection-asset'
import { createProfileValidateFn } from './profiles'
import { createSceneValidateFn } from './scenes'
import { createThirdPartyAssetValidateFn } from './third-party-asset'

export function createOnChainAccessCheckValidateFns(
  components: OnChainAccessCheckerComponents
): Record<EntityType, ValidateFn> {
  const v1andV2collectionAssetValidateFn = createV1andV2collectionAssetValidateFn(components)
  const thirdPartyAssetValidateFn = createThirdPartyAssetValidateFn(components)
  return {
    [EntityType.PROFILE]: createProfileValidateFn(components),
    [EntityType.SCENE]: createSceneValidateFn(components),
    [EntityType.WEARABLE]: createWearableValidateFn(
      components,
      v1andV2collectionAssetValidateFn,
      thirdPartyAssetValidateFn
    ),
    [EntityType.STORE]: createStoreValidateFn(components),
    [EntityType.EMOTE]: createEmoteValidateFn(components, v1andV2collectionAssetValidateFn, thirdPartyAssetValidateFn)
  }
}
