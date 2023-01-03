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
    const logger = components.logs.getLogger('collection asset access validation')

    const { timestamp } = deployment.entity
    let verified = false

    if (isThirdParty(deployment.entity.metadata)) {
      // This should always happen as the metadata validation ran before

      const block = await components.subGraphs.l2BlockSearch.findBlockForTimestamp(timestamp)
      if (block) {
        const metadata = deployment.entity.metadata as ThirdPartyProps
        const merkleProof = metadata.merkleProof

        const ethAddress = components.externalCalls.ownerAddress(deployment.auditInfo)

        const thirdPartyId = getThirdPartyId(asset)

        const bufferedProofs = merkleProof.proof.map((value) => toHexBuffer(value))
        const root = generateRoot(merkleProof.index, merkleProof.entityHash, bufferedProofs)
        verified = await components.subGraphs.L2.checker.validateThirdParty(ethAddress, thirdPartyId, root, block.block)
      } else {
        logger.warn(`Cannot find block for timestamp ${timestamp}`)
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
