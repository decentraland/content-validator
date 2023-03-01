import { OnChainAccessCheckerComponents, ValidateFn } from '../../types'
import { createItemValidateFn } from './items/items'

export function createEmoteValidateFn(components: OnChainAccessCheckerComponents): ValidateFn {
  return createItemValidateFn(components, ['blockchain-collection-v2-asset', 'blockchain-collection-third-party'])
}
