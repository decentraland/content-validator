import { Emote, EntityType, Profile, Scene, Store, ValidateFunction, Wearable } from '@dcl/schemas'

type Params = {
  validate: ValidateFunction<Scene | Profile | Wearable | Store | Emote>
  maxSizeInMB: number // in MB
}

export const entityParameters: Record<EntityType, Params> = {
  scene: {
    validate: Scene.validate,
    maxSizeInMB: 15
  },
  profile: {
    validate: Profile.validate,
    maxSizeInMB: 2
  },
  wearable: {
    validate: Wearable.validate,
    maxSizeInMB: 3
  },
  store: {
    validate: Store.validate,
    maxSizeInMB: 1
  },
  emote: {
    validate: Emote.validate,
    maxSizeInMB: 3
  }
}
