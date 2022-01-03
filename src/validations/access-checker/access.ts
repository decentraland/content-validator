import { EntityType } from 'dcl-catalyst-commons'
import { validationFailed } from '../..'
import { Validation } from '../../types'
import { profiles } from './profiles'
import { scenes } from './scenes'
import { wearables } from './wearables'

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const access: Validation = {
  validate: async (args) => {
    const type = args.deployment.entity.type
    switch (type) {
      case EntityType.SCENE:
        return scenes.validate(args)
      case EntityType.PROFILE:
        return profiles.validate(args)
      case EntityType.WEARABLE:
        return wearables.validate(args)
      default:
        return validationFailed('Unknown type provided')
    }
  },
}
