import { OnChainAccessCheckerComponents } from '../../../types'
import { validateAll } from '../../validations'
import { createOutfitsNamesOwnershipValidateFn, createOutfitsWearablesOwnershipValidateFn } from '../common/outfits'

export function createOutfitsValidateFn(components: Pick<OnChainAccessCheckerComponents, 'client' | 'externalCalls'>) {
  return validateAll(
    createOutfitsWearablesOwnershipValidateFn(components, components.client),
    createOutfitsNamesOwnershipValidateFn(components, components.client)
  )
}
