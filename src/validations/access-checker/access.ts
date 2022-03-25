import { EntityType } from 'dcl-catalyst-commons'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '..'

import { OK, Validation } from '../../types'
import { profiles } from './profiles'
import { scenes } from './scenes'
import { stores } from './stores'
import { wearables } from './wearables'

const accessCheckers: Record<EntityType, Validation> = {
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
    const { deployment, externalCalls } = args
    const deployedBeforeDCLLaunch = deployment.entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP
    const address = externalCalls.ownerAddress(deployment.auditInfo)
    if (deployedBeforeDCLLaunch && externalCalls.isAddressOwnedByDecentraland(address)) return OK

    return accessCheckers[deployment.entity.type].validate(args)
  },
}
