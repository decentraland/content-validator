import { SubgraphAccessCheckerComponents, ValidateFn } from '../../types'
import { createItemValidateFn } from './items/items'

export function createWearableValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'externalCalls'>
): ValidateFn {
  return createItemValidateFn(components, [
    'off-chain',
    'blockchain-collection-v1-asset',
    'blockchain-collection-v2-asset',
    'blockchain-collection-third-party'
  ])
}
