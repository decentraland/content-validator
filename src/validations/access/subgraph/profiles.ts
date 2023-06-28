import { SubgraphAccessCheckerComponents } from '../../../types'
import { createPointerCommonAccessValidateFn } from '../common/profile'

export function createProfileValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'theGraphClient' | 'externalCalls'>
) {
  return createPointerCommonAccessValidateFn(components, components.theGraphClient, components.theGraphClient)
}
