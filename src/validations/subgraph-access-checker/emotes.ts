import { SubgraphAccessCheckerComponents, ValidateFn } from '../../types'
import { createItemValidateFn } from './items/items'

export function createEmoteValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'logs' | 'theGraphClient'>
): ValidateFn {
  return createItemValidateFn(components, ['blockchain-collection-v2-asset', 'blockchain-collection-third-party'])
}
