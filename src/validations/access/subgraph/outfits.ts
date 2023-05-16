import { SubgraphAccessCheckerComponents } from '../../../types'
import { validateAll } from '../../validations'
import { createOutfitsNamesOwnershipValidateFn, createOutfitsWearablesOwnershipValidateFn } from '../common/outfits'

export function createOutfitsValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'theGraphClient' | 'externalCalls'>
) {
  return validateAll(
    createOutfitsWearablesOwnershipValidateFn(components, components.theGraphClient),
    createOutfitsNamesOwnershipValidateFn(components, components.theGraphClient)
  )
}
