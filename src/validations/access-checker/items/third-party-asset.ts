import { generateRoot } from '@dcl/content-hash-tree'
import { isThirdParty, ThirdPartyProps } from '@dcl/schemas'
import { BlockchainCollectionThirdParty } from '@dcl/urn-resolver'
import { ContentValidatorComponents, DeploymentToValidate, OK, validationFailed } from '../../../types'
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
    components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient' | 'subGraphs'>,
    asset: BlockchainCollectionThirdParty,
    deployment: DeploymentToValidate
  ) {
    const { checker } = components.subGraphs.L2

    const { timestamp } = deployment.entity
    let verified = false

    if (isThirdParty(deployment.entity.metadata)) {
      // This should always happen as the metadata validation ran before
      const metadata = deployment.entity.metadata as ThirdPartyProps
      const merkleProof = metadata.merkleProof

      const ethAddress = components.externalCalls.ownerAddress(deployment.auditInfo)

      const thirdPartyId = getThirdPartyId(asset)

      const bufferedProofs = merkleProof.proof.map((value) => toHexBuffer(value))
      const root = generateRoot(merkleProof.index, merkleProof.entityHash, bufferedProofs)

      const { blockAtDeployment, blockFiveMinBeforeDeployment } =
        await components.theGraphClient.findBlocksForTimestamp(timestamp, components.subGraphs.l2BlockSearch)

      const batch: Promise<boolean>[] = []
      if (blockAtDeployment) {
        batch.push(checker.validateThirdParty(ethAddress, thirdPartyId, root, blockAtDeployment))
      }
      if (blockFiveMinBeforeDeployment) {
        batch.push(checker.validateThirdParty(ethAddress, thirdPartyId, root, blockFiveMinBeforeDeployment))
      }

      verified = (await Promise.all(batch)).some((r) => r)
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
