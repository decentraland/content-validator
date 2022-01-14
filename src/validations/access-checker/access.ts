import { EntityType } from 'dcl-catalyst-commons'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '..'

import { OK, Validation } from '../../types'
import { profiles } from './profiles'
import { scenes } from './scenes'
import { stores } from './stores'
import { wearables } from './wearables'

const accessCheckers = {
  [EntityType.PROFILE]: profiles,
  [EntityType.SCENE]: scenes,
  [EntityType.WEARABLE]: wearables,
  [EntityType.STORE]: stores,
}

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export const access: Validation = {
  validate: async (args) => {
    if (args.deployment.entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP) return OK
    const type = args.deployment.entity.type
    const accessChecker = accessCheckers[type]

    return accessChecker.validate(args)
  },
}
