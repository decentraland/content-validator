import { ContentValidatorComponents, DeploymentToValidate } from '../..'
import { itemsValidation } from './items/items'

export async function emotes(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient'>,
  deployment: DeploymentToValidate
) {
  return itemsValidation(components, deployment, [
    'blockchain-collection-v2-asset',
    'blockchain-collection-third-party'
  ])
}
