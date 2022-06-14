import { ContentValidatorComponents, Validation } from '../../types'
import { itemsValidation } from './items/items'

export const wearables: Validation = {
  validate: async (
    components: Pick<
      ContentValidatorComponents,
      'externalCalls' | 'logs' | 'theGraphClient'
    >,
    deployment
  ) => {
    return itemsValidation.validate(components, deployment, [
      'off-chain',
      'blockchain-collection-v1-asset',
      'blockchain-collection-v2-asset',
      'blockchain-collection-third-party'
    ])
  }
}
