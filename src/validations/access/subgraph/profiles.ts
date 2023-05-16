import { SubgraphAccessCheckerComponents } from '../../../types'
import { validateAll } from '../../validations'
import { createItemOwnershipValidateFn, createNamesOwnershipValidateFn } from '../common/profile'

export function createProfileValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'theGraphClient' | 'externalCalls'>
) {
  return validateAll(
    createNamesOwnershipValidateFn(components, components.theGraphClient),
    createItemOwnershipValidateFn(components, components.theGraphClient)
  )
}
