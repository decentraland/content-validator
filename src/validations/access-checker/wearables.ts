import { verifyProof } from '@dcl/content-hash-tree'
import { hashV0, hashV1, keccak256Hash } from '@dcl/hashing'
import { EthAddress, MerkleProof, ThirdPartyWearable } from '@dcl/schemas'
import {
  BlockchainCollectionThirdParty,
  BlockchainCollectionV1Asset,
  BlockchainCollectionV2Asset,
  OffChainAsset,
  parseUrn
} from '@dcl/urn-resolver'
import ms from 'ms'
import {
  EntityWithEthAddress,
  validationFailed,
  OK,
  Validation
} from '../../types'

const L1_NETWORKS = ['mainnet', 'ropsten', 'kovan', 'rinkeby', 'goerli']
const L2_NETWORKS = ['matic', 'mumbai']

// These keys are required by the protocol to be a subset and present in the merkle proof hashing keys.
// Note: deletions would not be a problem, but in case of adding a key here,
// you MUST review the validation in order to not break the sync between catalysts (aka failed deployments)
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
const ACCESS_WINDOW_IN_SECONDS = ms('15s') / 1000

const validUrnTypes = [
  'off-chain',
  'blockchain-collection-v1-asset',
  'blockchain-collection-v2-asset',
  'blockchain-collection-third-party'
] as const

type SupportedAssets =
  | BlockchainCollectionV1Asset
  | BlockchainCollectionV2Asset
  | OffChainAsset
  | BlockchainCollectionThirdParty

type WearableItemPermissionsData = {
  collectionCreator: string
  collectionManagers: string[]
  itemManagers: string[]
  isApproved: boolean
  isCompleted: boolean
  contentHash: string
  committee: EthAddress[]
}

type WearableCollections = {
  collections: WearableCollection[]
  accounts: { id: EthAddress }[]
}

export type WearableCollection = {
  creator: string
  managers: string[]
  isApproved: boolean
  isCompleted: boolean
  items: WearableCollectionItem[]
}

type WearableCollectionItem = {
  managers: string[]
  contentHash: string
}

const alreadySeen = (
  resolvedPointers: SupportedAssets[],
  parsed: SupportedAssets
): boolean => {
  return resolvedPointers.some((alreadyResolved) =>
    resolveSameUrn(alreadyResolved, parsed)
  )
}

const resolveSameUrn = (
  alreadyParsed: SupportedAssets,
  parsed: SupportedAssets
): boolean => {
  const alreadyParsedCopy = Object.assign({}, alreadyParsed)
  const parsedCopy = Object.assign({}, parsed)
  alreadyParsedCopy.uri = new URL('urn:same')
  parsedCopy.uri = new URL('urn:same')
  return JSON.stringify(alreadyParsedCopy) == JSON.stringify(parsedCopy)
}

const parseUrnNoFail = async (urn: string): Promise<SupportedAssets | null> => {
  try {
    const parsed = await parseUrn(urn)
    if (parsed?.type === 'blockchain-collection-v1-asset') {
      return parsed
    }
    if (parsed?.type === 'blockchain-collection-v2-asset') {
      return parsed
    }
    if (parsed?.type === 'off-chain') {
      return parsed
    }
    if (parsed?.type === 'blockchain-collection-third-party') {
      return parsed
    }
  } catch {}
  return null
}

const toHexBuffer = (value: string): Buffer => {
  if (value.startsWith('0x')) {
    return Buffer.from(value.substring(2), 'hex') // removing first 2 characters (0x)
  }
  return Buffer.from(value, 'hex')
}

const getThirdPartyId = (urn: BlockchainCollectionThirdParty): string =>
  `urn:decentraland:${urn.network}:collections-thirdparty:${urn.thirdPartyName}`

/**
 * Given the pointers (URNs), determine which layer should be used to check the access.
 * Checks if the ethereum address has access to the collection.
 * @public
 */
export const wearables: Validation = {
  validate: async (deployment, { externalCalls, logs }) => {
    const logger = logs.getLogger('wearables access validator')

    const hasPermission = async (
      subgraphUrl: string,
      collection: string,
      itemId: string,
      block: number,
      entity: EntityWithEthAddress
    ): Promise<boolean> => {
      try {
        const { content, metadata } = entity
        const permissions: WearableItemPermissionsData =
          await getCollectionItems(subgraphUrl, collection, itemId, block)
        const ethAddressLowercase = entity.ethAddress.toLowerCase()

        if (!!permissions.contentHash) {
          const deployedByCommittee =
            permissions.committee.includes(ethAddressLowercase)
          const calculateHashes = () => {
            // Compare both by key and hash
            const compare = (
              a: { key: string; hash: string },
              b: { key: string; hash: string }
            ) => {
              if (a.hash > b.hash) return 1
              else if (a.hash < b.hash) return -1
              else return a.key > b.key ? 1 : -1
            }

            const contentAsJson = (content ?? [])
              .map(({ file, hash }) => ({ key: file, hash }))
              .sort(compare)
            const buffer = Buffer.from(
              JSON.stringify({ content: contentAsJson, metadata })
            )
            return Promise.all([hashV0(buffer), hashV1(buffer)])
          }
          return (
            deployedByCommittee &&
            (await calculateHashes()).includes(permissions.contentHash)
          )
        } else {
          const addressHasAccess =
            (permissions.collectionCreator &&
              permissions.collectionCreator === ethAddressLowercase) ||
            (permissions.collectionManagers &&
              permissions.collectionManagers.includes(ethAddressLowercase)) ||
            (permissions.itemManagers &&
              permissions.itemManagers.includes(ethAddressLowercase))

          // Deployments to the content server are made after the collection is completed, so that the committee can then approve it.
          // That's why isCompleted must be true, but isApproved must be false. After the committee approves the wearable, there can't be any more changes
          const isCollectionValid =
            !permissions.isApproved && permissions.isCompleted

          return addressHasAccess && isCollectionValid
        }
      } catch (error) {
        logger.error(
          `Error checking permission for (${collection}-${itemId}) at block ${block}`
        )
        return false
      }
    }

    const getCollectionItems = async (
      subgraphUrl: string,
      collection: string,
      itemId: string,
      block: number
    ): Promise<WearableItemPermissionsData> => {
      const query = `
             query getCollectionRoles($collection: String!, $itemId: String!, $block: Int!) {
                collections(where:{ id: $collection }, block: { number: $block }) {
                  creator
                  managers
                  isApproved
                  isCompleted
                  items(where:{ id: $itemId }) {
                    managers
                    contentHash
                  }
                }

                accounts(where:{ isCommitteeMember: true }, block: { number: $block }) {
                  id
                }
            }`

      const result = await externalCalls.queryGraph<WearableCollections>(
        subgraphUrl,
        query,
        {
          collection,
          itemId: `${collection}-${itemId}`,
          block
        }
      )
      const collectionResult = result.collections[0]
      const itemResult = collectionResult?.items[0]
      return {
        collectionCreator: collectionResult?.creator,
        collectionManagers: collectionResult?.managers,
        isApproved: collectionResult?.isApproved,
        isCompleted: collectionResult?.isCompleted,
        itemManagers: itemResult?.managers,
        contentHash: itemResult?.contentHash,
        committee: result.accounts.map(({ id }) => id.toLowerCase())
      }
    }

    const getWindowFromTimestamp = (
      timestamp: number
    ): {
      max: number
      min: number
    } => {
      const windowMin = timestamp - Math.floor(ACCESS_WINDOW_IN_SECONDS / 2)
      const windowMax = timestamp + Math.ceil(ACCESS_WINDOW_IN_SECONDS / 2)
      return {
        max: windowMax,
        min: windowMin
      }
    }

    const findBlocksForTimestamp = async (
      blocksSubgraphUrl: string,
      timestamp: number
    ): Promise<{
      blockNumberAtDeployment: number | undefined
      blockNumberFiveMinBeforeDeployment: number | undefined
    }> => {
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
        const result = await externalCalls.queryGraph<{
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
          blockNumberFiveMinBeforeDeployment:
            !!blockNumberFiveMinBeforeDeployment
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

    const checkCollectionAccess = async (
      blocksSubgraphUrl: string,
      collectionsSubgraphUrl: string,
      collection: string,
      itemId: string,
      entity: EntityWithEthAddress
    ): Promise<boolean> => {
      const { timestamp } = entity
      try {
        const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
          await findBlocksForTimestamp(blocksSubgraphUrl, timestamp)
        // It could happen that the subgraph hasn't synced yet, so someone who just lost access still managed to make a deployment. The problem would be that when other catalysts perform
        // the same check, the subgraph might have synced and the deployment is no longer valid. So, in order to prevent inconsistencies between catalysts, we will allow all deployments that
        // have access now, or had access 5 minutes ago.

        const hasPermissionOnBlock = async (blockNumber: number | undefined) =>
          !!blockNumber &&
          (await hasPermission(
            collectionsSubgraphUrl,
            collection,
            itemId,
            blockNumber,
            entity
          ))
        return (
          (await hasPermissionOnBlock(blockNumberAtDeployment)) ||
          (await hasPermissionOnBlock(blockNumberFiveMinBeforeDeployment))
        )
      } catch (error) {
        logger.error(
          `Error checking wearable access (${collection}, ${itemId}, ${entity.ethAddress}, ${timestamp}, ${blocksSubgraphUrl}).`
        )
        return false
      }
    }

    const getMerkleRoot = async ({
      block,
      thirdPartyId
    }: {
      block: number
      thirdPartyId: string
    }): Promise<string | undefined> => {
      const query = `
      query MerkleRoot($id: String!, $block: Int!) {
        thirdParties(where: { id: $id, isApproved: true }, block: { number: $block }, first: 1) {
          root
        }
      }`

      const result = await externalCalls.queryGraph<{
        thirdParties: { root: string }[]
      }>(externalCalls.subgraphs.L2.thirdPartyRegistry, query, {
        id: thirdPartyId,
        block
      })
      if (!result.thirdParties || result.thirdParties.length < 1) return
      return result.thirdParties[0]?.root
    }

    const verifyHash = async (
      metadata: ThirdPartyWearable,
      merkleRoot: string
    ): Promise<boolean> => {
      // Validate merkle proof data is valid
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
        logger.debug(
          `Merkle proof hashing keys don't satisfy the required keys`,
          {
            requiredKeys: JSON.stringify(MERKLE_PROOF_REQUIRED_KEYS),
            hashingKeys: JSON.stringify(merkleProof.hashingKeys)
          }
        )
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
      const bufferedProofs = merkleProof.proof.map((value) =>
        toHexBuffer(value)
      )
      const bufferedMerkleRoot = toHexBuffer(merkleRoot)
      return verifyProof(
        merkleProof.index,
        merkleProof.entityHash,
        bufferedProofs,
        bufferedMerkleRoot
      )
    }

    /**
     * Verifies Third Party Wearable access by doing a Merkle Tree based verification, where the merkle root is stored in the blockchain
     * and the proofs come in the wearable metadata.
     * It also does a CRC using the metadata and some hashing keys:
     *  - Hashing keys must contain all required keys defined in MERKLE_PROOF_REQUIRED_KEYS
     *
     * This checks are verified using blocks in a 5 minutes window from the deployment timestamp
     */
    const verifyMerkleProofedEntity = async (
      urn: BlockchainCollectionThirdParty
    ): Promise<boolean> => {
      // do merkle proofed entity validation, required keys are defined by the Catalyst and must be a subset of the hashingKeys from the MerkleProof to succeed
      const metadata = deployment.entity.metadata as ThirdPartyWearable
      const thirdPartyId = getThirdPartyId(urn)
      const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
        await findBlocksForTimestamp(
          externalCalls.subgraphs.L2.blocks,
          deployment.entity.timestamp
        )

      const merkleRoots: string[] = []
      const hasPermissionOnBlock = async (blockNumber: number | undefined) => {
        try {
          if (!blockNumber) return false
          const merkleRoot = await getMerkleRoot({
            block: blockNumber,
            thirdPartyId
          })
          if (!merkleRoot) {
            logger.debug(
              `Merkle proof not found for given block and third party ID`,
              { blockNumber, thirdPartyId }
            )
            return false
          }
          merkleRoots.push(merkleRoot)
          return await verifyHash(metadata, merkleRoot)
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

    const { pointers } = deployment.entity
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    const resolvedPointers: SupportedAssets[] = []
    // deduplicate pointer resolution
    for (const pointer of pointers) {
      const parsed = await parseUrnNoFail(pointer)
      if (!parsed)
        return validationFailed(
          `Wearable pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${pointer})`
        )

      if (!alreadySeen(resolvedPointers, parsed)) resolvedPointers.push(parsed)
    }

    if (resolvedPointers.length > 1)
      return validationFailed(
        `Only one pointer is allowed when you create a Wearable. Received: ${pointers}`
      )

    const parsed = resolvedPointers[0]

    if (!validUrnTypes.includes(parsed.type)) {
      return validationFailed(
        `Could not resolve the contractAddress of the urn ${parsed}`
      )
    }

    if (parsed.type === 'off-chain') {
      // Validate Off Chain Asset
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following wearable: '${parsed.uri}'`
        )
    } else if (
      parsed?.type === 'blockchain-collection-v1-asset' ||
      parsed?.type === 'blockchain-collection-v2-asset'
    ) {
      // L1 or L2 so contractAddress is present
      const collection = parsed.contractAddress!
      const network = parsed.network

      const isL1 = L1_NETWORKS.includes(network)
      const isL2 = L2_NETWORKS.includes(network)
      if (!isL1 && !isL2)
        return validationFailed(
          `Found an unknown network on the urn '${network}'`
        )

      const blocksSubgraphUrl = isL1
        ? externalCalls.subgraphs.L1.blocks
        : externalCalls.subgraphs.L2.blocks

      const collectionsSubgraphUrl = isL1
        ? externalCalls.subgraphs.L1.collections
        : externalCalls.subgraphs.L2.collections

      const hasAccess = await checkCollectionAccess(
        blocksSubgraphUrl,
        collectionsSubgraphUrl,
        collection,
        parsed.id,
        {
          ...deployment.entity,
          ethAddress
        }
      )

      if (!hasAccess) {
        if (isL2)
          return validationFailed(
            `The provided Eth Address does not have access to the following wearable: (${parsed.contractAddress}, ${parsed.id})`
          )

        // Some L1 collections are deployed by Decentraland Address
        // Maybe this is not necessary as we already know that it's a 'blockchain-collection-v1-asset'
        const isAllowlistedCollection = parsed.uri
          .toString()
          .startsWith('urn:decentraland:ethereum:collections-v1')
        if (
          !externalCalls.isAddressOwnedByDecentraland(ethAddress) ||
          !isAllowlistedCollection
        ) {
          return validationFailed(
            `The provided Eth Address '${ethAddress}' does not have access to the following wearable: '${parsed.uri}'`
          )
        }
      }
    } else if (parsed?.type === 'blockchain-collection-third-party') {
      // Third Party wearables are validated doing merkle tree based verification proof
      const verified = await verifyMerkleProofedEntity(parsed)
      if (!verified) {
        return validationFailed(`Couldn't verify merkle proofed entity`)
      }
    }
    return OK
  }
}
