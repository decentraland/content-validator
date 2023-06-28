import { OnChainAccessCheckerComponents } from '../../../types'
import { createPointerCommonAccessValidateFn } from '../common/profile'

export function createProfileValidateFn(components: Pick<OnChainAccessCheckerComponents, 'client' | 'externalCalls'>) {
  return createPointerCommonAccessValidateFn(components, components.client, components.client)
}
