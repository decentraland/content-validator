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

// These keys are required by the protocol to be a subset and present in the merkle proof hashing keys.
// Note: deletions would not be a problem, but in case of adding a key here,
// you MUST review the validation in order to not break the sync between catalysts (aka failed deployments)
// Esto podría ir en SCHEMAS
export const MERKLE_PROOF_REQUIRED_KEYS = [
  'id',
  'name',
  'description',
  'i18n',
  'image',
  'thumbnail',
  'data',
  'content'
] as const

// When we want to find a block for a specific timestamp, we define an access window. This means that
// we will place will try to find the closes block to the timestamp, but only if it's within the window
const ACCESS_WINDOW_IN_SECONDS = 15

function toHexBuffer(value: string): Buffer {
  if (value.startsWith('0x')) {
    return Buffer.from(value.substring(2), 'hex') // removing first 2 characters (0x)
  }
  return Buffer.from(value, 'hex')
}

function getWindowFromTimestamp(timestamp: number): {
  max: number
  min: number
} {
  const windowMin = timestamp - Math.floor(ACCESS_WINDOW_IN_SECONDS / 2)
  const windowMax = timestamp + Math.ceil(ACCESS_WINDOW_IN_SECONDS / 2)
  return {
    max: windowMax,
    min: windowMin
  }
}

async function findBlocksForTimestamp(
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
  blocksSubgraphUrl: string,
  timestamp: number,
  logger: ILoggerComponent.ILogger
): Promise<{
  blockNumberAtDeployment: number | undefined
  blockNumberFiveMinBeforeDeployment: number | undefined
}> {
  const query = `
    query getBlockForTimestamp($timestamp: Int!, $timestampMin: Int!, $timestampMax: Int!, $timestamp5Min: Int!, $timestamp5MinMax: Int!, $timestamp5MinMin: Int!) {
      before: blocks(where: { timestamp_lte: $timestamp, timestamp_gte: $timestampMin  }, first: 1, orderBy: timestamp, orderDirection: desc) {
        number
      }
      after: blocks(where: { timestamp_gte: $timestamp, timestamp_lte: $timestampMax }, first: 1, orderBy: timestamp, orderDirection: asc) {
        number
      }
      fiveMinBefore: blocks(where: { timestamp_lte: $timestamp5Min, timestamp_gte: $timestamp5MinMin, }, first: 1, orderBy: timestamp, orderDirection: desc) {
        number
      }
      fiveMinAfter: blocks(where: { timestamp_gte: $timestamp5Min, timestamp_lte: $timestamp5MinMax }, first: 1, orderBy: timestamp, orderDirection: asc) {
        number
      }
    }
    `
  try {
    const timestampSec = Math.ceil(timestamp / 1000)
    const timestamp5MinAgo = timestampSec - 60 * 5
    const window = getWindowFromTimestamp(timestampSec)
    const window5MinAgo = getWindowFromTimestamp(timestamp5MinAgo)
    const result = await components.externalCalls.queryGraph<{
      before: { number: string }[]
      after: { number: string }[]
      fiveMinBefore: { number: string }[]
      fiveMinAfter: { number: string }[]
    }>(blocksSubgraphUrl, query, {
      timestamp: timestampSec,
      timestampMax: window.max,
      timestampMin: window.min,
      timestamp5Min: timestamp5MinAgo,
      timestamp5MinMax: window5MinAgo.max,
      timestamp5MinMin: window5MinAgo.min
    })

    // To get the deployment's block number, we check the one immediately after the entity's timestamp. Since it could not exist, we default to the one immediately before.
    const blockNumberAtDeployment =
      result.after[0]?.number ?? result.before[0]?.number
    const blockNumberFiveMinBeforeDeployment =
      result.fiveMinAfter[0]?.number ?? result.fiveMinBefore[0]?.number
    if (
      blockNumberAtDeployment === undefined &&
      blockNumberFiveMinBeforeDeployment === undefined
    ) {
      throw new Error(`Failed to find blocks for the specific timestamp`)
    }

    return {
      blockNumberAtDeployment: !!blockNumberAtDeployment
        ? parseInt(blockNumberAtDeployment)
        : undefined,
      blockNumberFiveMinBeforeDeployment: !!blockNumberFiveMinBeforeDeployment
        ? parseInt(blockNumberFiveMinBeforeDeployment)
        : undefined
    }
  } catch (e) {
    const error = (e as any)?.message
    logger.error(`Error fetching the block number for timestamp`, {
      timestamp,
      error
    })
    throw error
  }
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
  // The keys used to create the hash MUST be present if they're required.
  if (
    !MERKLE_PROOF_REQUIRED_KEYS.every((key) =>
      merkleProof.hashingKeys.includes(key)
    )
  ) {
    logger.debug(`Merkle proof hashing keys don't satisfy the required keys`, {
      requiredKeys: JSON.stringify(MERKLE_PROOF_REQUIRED_KEYS),
      hashingKeys: JSON.stringify(merkleProof.hashingKeys)
    })
    return false
  }
  const generatedCrcHash = keccak256Hash(
    metadata,
    metadata.merkleProof.hashingKeys
  )
  // The hash provided in the merkleProof for the entity MUST match the hash generated by the validator.
  if (metadata.merkleProof.entityHash !== generatedCrcHash) {
    logger.debug(
      `The hash provided in the merkleProof doesn't match with the generated by the validator`,
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

  const result = await components.externalCalls.queryGraph<{
    thirdParties: { root: string }[]
  }>(components.externalCalls.subgraphs.L2.thirdPartyRegistry, query, {
    id: thirdPartyId,
    block
  })
  if (!result.thirdParties || result.thirdParties.length < 1) return
  return result.thirdParties[0]?.root
}

async function verifyMerkleProofedEntity(
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
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
    await findBlocksForTimestamp(
      components,
      components.externalCalls.subgraphs.L2.blocks,
      deployment.entity.timestamp,
      logger
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
    components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs'>,
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
