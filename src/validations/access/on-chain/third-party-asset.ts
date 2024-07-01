import { generateRoot } from '@dcl/content-hash-tree'
import { isThirdParty, ThirdPartyProps } from '@dcl/schemas'
import { BlockchainCollectionThirdParty } from '@dcl/urn-resolver'
import {
  DeploymentToValidate,
  OK,
  OnChainAccessCheckerComponents,
  ThirdPartyAssetValidateFn,
  validationFailed
} from '../../../types'
import { getThirdPartyId, toHexBuffer } from '../../../utils'

export function createThirdPartyAssetValidateFn(
  components: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>
): ThirdPartyAssetValidateFn {
  return async function validateFn(asset: BlockchainCollectionThirdParty, deployment: DeploymentToValidate) {
    const logger = components.logs.getLogger('third-party-asset-validation')
    const { checker } = components.L2

    const { timestamp } = deployment.entity
    let verified = false

    if (isThirdParty(deployment.entity.metadata)) {
      // This should always happen as the metadata validation ran before
      const metadata = deployment.entity.metadata as ThirdPartyProps
      const merkleProof = metadata.merkleProof

      const thirdPartyId = getThirdPartyId(asset)

      const bufferedProofs = merkleProof.proof.map((value) => toHexBuffer(value))
      const root = generateRoot(merkleProof.index, merkleProof.entityHash, bufferedProofs)

      const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
        await components.client.findBlocksForTimestamp(timestamp, components.L2.blockSearch)

      const validateThirdParty = async (block: number) => {
        try {
          return await checker.validateThirdParty(thirdPartyId, root, block)
        } catch (err: any) {
          logger.warn(err)
          return false
        }
      }

      if (blockNumberAtDeployment) {
        verified = await validateThirdParty(blockNumberAtDeployment)
      }

      if (!verified && blockNumberFiveMinBeforeDeployment) {
        verified = await validateThirdParty(blockNumberFiveMinBeforeDeployment)
      }
    }

    if (!verified) {
      return validationFailed(`Couldn't verify merkle proofed entity`)
    }
    return OK
  }
}
