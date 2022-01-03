import { Profile, Scene, Wearable } from '@dcl/schemas'
import { EntityType } from 'dcl-catalyst-commons'
import { ADR_X_TIMESTAMP } from '.'
import { conditionalValidation } from '../types'

/**
 * Validate entities metadata against its corresponding schema
 * @public
 */
export const metadata = conditionalValidation({
  predicate: ({ deployment }) => {
    if (deployment.entity.timestamp <= ADR_X_TIMESTAMP) return true
    // todo: move this map to catalyst-commons
    const validate = {
      [EntityType.PROFILE]: Profile.validate,
      [EntityType.SCENE]: Scene.validate,
      [EntityType.WEARABLE]: Wearable.validate,
    }
    return validate[deployment.entity.type](deployment.entity.metadata)
  },
  message: ({ deployment }) => `The metadata for this entity type (${deployment.entity.type}) is not valid.`,
})
