import { OffChainAsset } from '@dcl/urn-resolver'
import { DeploymentToValidate, OK } from '../../..'
import { ContentValidatorComponents, validationFailed } from '../../../types'
import { AssetValidation } from './items'

export const offChainAssetValidation: AssetValidation = {
  validateAsset(
    components: Pick<ContentValidatorComponents, 'externalCalls'>,
    asset: OffChainAsset,
    deployment: DeploymentToValidate
  ) {
    const ethAddress = components.externalCalls.ownerAddress(
      deployment.auditInfo
    )
    if (!components.externalCalls.isAddressOwnedByDecentraland(ethAddress))
      return validationFailed(
        `The provided Eth Address '${ethAddress}' does not have access to the following wearable: '${asset.uri}'`
      )
    return OK
  },
  canValidate(asset): asset is OffChainAsset {
    return asset.type === 'off-chain'
  }
}
