import {
  EntityType,
  Profile,
  Scene,
  Store,
  ValidateFunction,
  Wearable
} from '@dcl/schemas'

export type AcceptedEntityType = Scene | Profile | Wearable | Store

type Params = {
  validate: ValidateFunction<AcceptedEntityType>
  maxSizeInMB: number // in MB
}

type EntityParams = Record<EntityType, Params>

export const entityParameters: EntityParams = {
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
  }
}
