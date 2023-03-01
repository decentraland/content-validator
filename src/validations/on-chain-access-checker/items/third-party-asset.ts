import { generateRoot } from '@dcl/content-hash-tree'
import { isThirdParty, ThirdPartyProps } from '@dcl/schemas'
import { BlockchainCollectionThirdParty } from '@dcl/urn-resolver'
import { DeploymentToValidate, OK, OnChainAccessCheckerComponents, validationFailed } from '../../../types'
import { AssetValidation } from './items'

function toHexBuffer(value: string): Buffer {
  if (value.startsWith('0x')) {
    return Buffer.from(value.substring(2), 'hex') // removing first 2 characters (0x)
  }
  return Buffer.from(value, 'hex')
}

function getThirdPartyId(urn: BlockchainCollectionThirdParty): string {
  return `urn:decentraland:${urn.network}:collections-thirdparty:${urn.thirdPartyName}`
}

export const thirdPartyAssetValidation: AssetValidation = {
  async validateAsset(
    components: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>,
    asset: BlockchainCollectionThirdParty,
    deployment: DeploymentToValidate
  ) {
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
  },
  canValidate(asset): asset is BlockchainCollectionThirdParty {
    return asset.type === 'blockchain-collection-third-party'
  }
}
