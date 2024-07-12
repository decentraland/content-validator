import { generateRoot } from '@dcl/content-hash-tree'
import { isThirdParty, ThirdPartyProps } from '@dcl/schemas'
import { BlockchainCollectionLinkedWearablesAsset, BlockchainCollectionThirdParty } from '@dcl/urn-resolver'
import {
  DeploymentToValidate,
  LinkedWearableAssetValidateFn,
  OK,
  OnChainAccessCheckerComponents,
  ThirdPartyAssetValidateFn,
  validationFailed
} from '../../../types'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { getThirdPartyId, toHexBuffer } from '../../../utils'

async function verifyMerkleProofedEntity(
  components: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>,
  asset: BlockchainCollectionThirdParty | BlockchainCollectionLinkedWearablesAsset,
  deployment: DeploymentToValidate,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  const { timestamp } = deployment.entity
  let verified = false

  if (isThirdParty(deployment.entity.metadata)) {
    const metadata = deployment.entity.metadata as ThirdPartyProps
    const merkleProof = metadata.merkleProof

    const thirdPartyId = getThirdPartyId(asset)

    const bufferedProofs = merkleProof.proof.map((value) => toHexBuffer(value))
    const root = generateRoot(merkleProof.index, merkleProof.entityHash, bufferedProofs)

    const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
      await components.client.findBlocksForTimestamp(timestamp, components.L2.blockSearch)

    const validateThirdParty = async (block: number) => {
      try {
        return await components.L2.checker.validateThirdParty(thirdPartyId, root, block)
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

  return verified
}

export function createThirdPartyAssetValidateFn(
  components: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>
): ThirdPartyAssetValidateFn {
  return async function validateFn(asset: BlockchainCollectionThirdParty, deployment: DeploymentToValidate) {
    const logger = components.logs.getLogger('(on-chain) third-party-asset-validation')

    const verified = await verifyMerkleProofedEntity(components, asset, deployment, logger)
    if (!verified) {
      return validationFailed(`Couldn't verify merkle proofed entity for third-party wearable`)
    }
    return OK
  }
}

export function createLinkedWearableItemValidateFn(
  components: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>
): LinkedWearableAssetValidateFn {
  return async function validateFn(asset: BlockchainCollectionLinkedWearablesAsset, deployment: DeploymentToValidate) {
    const logger = components.logs.getLogger('(on-chain) third-party-asset-validation')

    const verified = await verifyMerkleProofedEntity(components, asset, deployment, logger)
    if (!verified) {
      return validationFailed(`Couldn't verify merkle proofed entity for linked wearable v2`)
    }
    return OK
  }
}
