import { verifyProof } from '@dcl/content-hash-tree'
import { keccak256Hash } from '@dcl/hashing'
import { isThirdParty, MerkleProof, ThirdPartyProps } from '@dcl/schemas'
import { BlockchainCollectionThirdParty } from '@dcl/urn-resolver'
import { ILoggerComponent } from '@well-known-components/interfaces'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  validationFailed
} from '../../../types'
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

async function verifyHash<T>(
  metadata: T & ThirdPartyProps,
  merkleRoot: string,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  if (!MerkleProof.validate(metadata.merkleProof)) {
    logger.debug('Merkle proof is not valid', {
      merkleProof: metadata.merkleProof
    })
    return false
  }
  const merkleProof = metadata.merkleProof
  const generatedCrcHash = keccak256Hash(
    metadata,
    metadata.merkleProof.hashingKeys
  )
  // The hash provided in the merkleProof for the entity MUST match the hash generated by the validator.
  if (metadata.merkleProof.entityHash !== generatedCrcHash) {
    logger.debug(
      `The hash provided in the merkleProof doesn't match the one generated by the validator`,
      {
        generatedCrcHash,
        entityHash: metadata.merkleProof.entityHash
      }
    )
    return false
  }

  // Verify if the entity belongs to the Merkle Tree.
  const bufferedProofs = merkleProof.proof.map((value) => toHexBuffer(value))
  const bufferedMerkleRoot = toHexBuffer(merkleRoot)
  return verifyProof(
    merkleProof.index,
    merkleProof.entityHash,
    bufferedProofs,
    bufferedMerkleRoot
  )
}

async function getMerkleRoot(
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
  block: number,
  thirdPartyId: string
): Promise<string | undefined> {
  const query = `
  query MerkleRoot($id: String!, $block: Int!) {
    thirdParties(where: { id: $id, isApproved: true }, block: { number: $block }, first: 1) {
      root
    }
  }`

  const result =
    await components.externalCalls.subgraphs.L2.thirdPartyRegistry.query<{
      thirdParties: { root: string }[]
    }>(query, {
      id: thirdPartyId,
      block
    })
  if (!result.thirdParties || result.thirdParties.length < 1) return
  return result.thirdParties[0]?.root
}

async function verifyMerkleProofedEntity(
  components: Pick<
    ContentValidatorComponents,
    'externalCalls' | 'theGraphClient'
  >,
  urn: BlockchainCollectionThirdParty,
  deployment: DeploymentToValidate,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  // do merkle proofed entity validation, required keys are defined by the Catalyst and must be a subset of the hashingKeys from the MerkleProof to succeed
  const metadata = deployment.entity.metadata as ThirdPartyProps
  if (!isThirdParty(deployment.entity.metadata)) {
    // This should never happen as the metadata validation ran before
    return false
  }

  const thirdPartyId = getThirdPartyId(urn)
  const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
    await components.theGraphClient.findBlocksForTimestamp(
      components.externalCalls.subgraphs.L2.blocks,
      deployment.entity.timestamp
    )

  const merkleRoots: string[] = []
  const hasPermissionOnBlock = async (blockNumber: number | undefined) => {
    try {
      if (!blockNumber) return false
      const merkleRoot = await getMerkleRoot(
        components,
        blockNumber,
        thirdPartyId
      )
      if (!merkleRoot) {
        logger.debug(
          `Merkle proof not found for given block and third party ID`,
          { blockNumber, thirdPartyId }
        )
        return false
      }
      merkleRoots.push(merkleRoot)
      return await verifyHash(metadata, merkleRoot, logger)
    } catch (e) {
      const error = (e as any)?.message
      logger.debug(error)
      return false
    }
  }

  const validMerkleProofedEntity =
    (await hasPermissionOnBlock(blockNumberAtDeployment)) ||
    (await hasPermissionOnBlock(blockNumberFiveMinBeforeDeployment))

  if (!validMerkleProofedEntity) {
    logger.debug(`Merkle Tree based verifications failed:`, {
      merkleProof: JSON.stringify(metadata.merkleProof),
      merkleRoots: JSON.stringify(merkleRoots),
      blocks: JSON.stringify([
        blockNumberAtDeployment,
        blockNumberFiveMinBeforeDeployment
      ])
    })
  }

  return validMerkleProofedEntity
}

export const thirdPartyAssetValidation: AssetValidation = {
  async validateAsset(
    components: Pick<
      ContentValidatorComponents,
      'externalCalls' | 'logs' | 'theGraphClient'
    >,
    asset: BlockchainCollectionThirdParty,
    deployment: DeploymentToValidate
  ) {
    const logger = components.logs.getLogger(
      'collection asset access validation'
    )
    // Third Party wearables are validated doing merkle tree based verification proof
    const verified = await verifyMerkleProofedEntity(
      components,
      asset,
      deployment,
      logger
    )
    if (!verified) {
      return validationFailed(`Couldn't verify merkle proofed entity`)
    }
    return OK
  },
  canValidate(asset): asset is BlockchainCollectionThirdParty {
    return asset.type === 'blockchain-collection-third-party'
  }
}
