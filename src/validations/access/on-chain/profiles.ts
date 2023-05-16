import { OnChainAccessCheckerComponents } from '../../../types'
import { validateAll } from '../../validations'
import { createItemOwnershipValidateFn, createNamesOwnershipValidateFn } from '../common/profile'

export function createProfileValidateFn(components: Pick<OnChainAccessCheckerComponents, 'client' | 'externalCalls'>) {
  return validateAll(
    createNamesOwnershipValidateFn(components, components.client),
    createItemOwnershipValidateFn(components, components.client)
  )
}
