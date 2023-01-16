import { ContentValidatorComponents, DeploymentToValidate } from '../../types'
import { itemsValidation } from './items/items'

export async function wearables(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient'>,
  deployment: DeploymentToValidate
) {
  return itemsValidation(components, deployment, [
    'off-chain',
    'blockchain-collection-v1-asset',
    'blockchain-collection-v2-asset',
    'blockchain-collection-third-party'
  ])
}
