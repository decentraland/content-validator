import { ContentValidatorComponents } from '../..'
import { Validation } from '../../types'
import { itemsValidation } from './items/items'

export const emotes: Validation = {
  validate: async (
    components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient'>,
    deployment
  ) => {
    return itemsValidation.validate(components, deployment, [
      'blockchain-collection-v2-asset',
      'blockchain-collection-third-party'
    ])
  }
}
