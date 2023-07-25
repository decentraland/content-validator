import { hashV0, hashV1 } from '@dcl/hashing'
import { EthAddress } from '@dcl/schemas'
import { BlockchainCollectionV1Asset, BlockchainCollectionV2Asset } from '@dcl/urn-resolver'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import {
  DeploymentToValidate,
  EntityWithEthAddress,
  L1_NETWORKS,
  L2_NETWORKS,
  OK,
  SubgraphAccessCheckerComponents,
  V1andV2collectionAssetValidateFn,
  validationFailed
} from '../../../types'

type ItemPermissionsData = {
  collectionCreator: string
  collectionManagers: string[]
  itemManagers: string[]
  isApproved: boolean
  isCompleted: boolean
  contentHash: string
  committee: EthAddress[]
}

type ItemCollections = {
  collections: ItemCollection[]
  accounts: { id: EthAddress }[]
}

type CollectionItem = {
  managers: string[]
  contentHash: string
}

export type ItemCollection = {
  creator: string
  managers: string[]
  isApproved: boolean
  isCompleted: boolean
  items: CollectionItem[]
}

async function getCollectionItems(
  subgraph: ISubgraphComponent,
  collection: string,
  itemId: string,
  block: number
): Promise<ItemPermissionsData> {
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

  const result = await subgraph.query<ItemCollections>(query, {
    collection,
    itemId: `${collection}-${itemId}`,
    block
  })
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

async function hasPermission(
  subgraph: ISubgraphComponent,
  collection: string,
  itemId: string,
  block: number,
  entity: EntityWithEthAddress,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  try {
    const { content, metadata } = entity
    const permissions: ItemPermissionsData = await getCollectionItems(subgraph, collection, itemId, block)
    const ethAddressLowercase = entity.ethAddress.toLowerCase()

    if (!!permissions.contentHash) {
      const deployedByCommittee = permissions.committee.includes(ethAddressLowercase)
      if (!deployedByCommittee) {
        logger.debug(`The eth address ${ethAddressLowercase} is not part of committee.`)
      }
      const calculateHashes = () => {
        // Compare both by key and hash
        const compare = (a: { key: string; hash: string }, b: { key: string; hash: string }) => {
          if (a.hash > b.hash) return 1
          else if (a.hash < b.hash) return -1
          else return a.key > b.key ? 1 : -1
        }

        const contentAsJson = (content ?? []).map(({ file, hash }) => ({ key: file, hash })).sort(compare)
        const buffer = Buffer.from(JSON.stringify({ content: contentAsJson, metadata }))
        return Promise.all([hashV0(buffer), hashV1(buffer)])
      }
      const hashes = await calculateHashes()
      const contentHashIsOk = hashes.includes(permissions.contentHash)
      if (!contentHashIsOk) {
        logger.debug(
          `The hash ${permissions.contentHash} doesn't match any of the calculated hashes: ${JSON.stringify(hashes)}.`
        )
      }
      return deployedByCommittee && contentHashIsOk
    } else {
      const addressHasAccess =
        (permissions.collectionCreator && permissions.collectionCreator === ethAddressLowercase) ||
        (permissions.collectionManagers && permissions.collectionManagers.includes(ethAddressLowercase)) ||
        (permissions.itemManagers && permissions.itemManagers.includes(ethAddressLowercase))

      // Deployments to the content server are made after the collection is completed, so that the committee can then approve it.
      // That's why isCompleted must be true, but isApproved must be false. After the committee approves the wearable, there can't be any more changes
      const isCollectionValid = !permissions.isApproved && permissions.isCompleted

      return addressHasAccess && isCollectionValid
    }
  } catch (error) {
    logger.error(`Error checking permission for (${collection}-${itemId}) at block ${block}. Error: ${error}`)
    return false
  }
}

async function checkCollectionAccess(
  components: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'theGraphClient'>,
  blocksSubgraph: ISubgraphComponent,
  collectionsSubgraph: ISubgraphComponent,
  collection: string,
  itemId: string,
  entity: EntityWithEthAddress,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  const { timestamp } = entity
  try {
    const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } =
      await components.theGraphClient.findBlocksForTimestamp(blocksSubgraph, timestamp)
    // It could happen that the subgraph hasn't synced yet, so someone who just lost access still managed to make a deployment. The problem would be that when other catalysts perform
    // the same check, the subgraph might have synced and the deployment is no longer valid. So, in order to prevent inconsistencies between catalysts, we will allow all deployments that
    // have access now, or had access 5 minutes ago.

    const hasPermissionOnBlock = async (blockNumber: number | undefined) =>
      !!blockNumber && (await hasPermission(collectionsSubgraph, collection, itemId, blockNumber, entity, logger))
    return (
      (await hasPermissionOnBlock(blockNumberAtDeployment)) ||
      (await hasPermissionOnBlock(blockNumberFiveMinBeforeDeployment))
    )
  } catch (error) {
    logger.error(
      `Error checking wearable access (${collection}, ${itemId}, ${entity.ethAddress}, ${timestamp}, ${blocksSubgraph}). Error: ${error}`
    )
    return false
  }
}

export function createV1andV2collectionAssetValidateFn(
  components: Pick<SubgraphAccessCheckerComponents, 'externalCalls' | 'logs' | 'subGraphs' | 'theGraphClient'>
): V1andV2collectionAssetValidateFn {
  return async function validateFn(
    asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
    deployment: DeploymentToValidate
  ) {
    const { externalCalls, subGraphs, logs } = components
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const logger = logs.getLogger('collection asset access validation')
    // L1 or L2 so contractAddress is present
    const collection = asset.contractAddress!
    const network = asset.network

    const isL1 = L1_NETWORKS.includes(network)
    const isL2 = L2_NETWORKS.includes(network)
    if (!isL1 && !isL2) return validationFailed(`Found an unknown network on the urn '${network}'`)

    const blocksSubgraphUrl = isL1 ? subGraphs.L1.blocks : subGraphs.L2.blocks

    const collectionsSubgraphUrl = isL1 ? subGraphs.L1.collections : subGraphs.L2.collections

    const hasAccess = await checkCollectionAccess(
      components,
      blocksSubgraphUrl,
      collectionsSubgraphUrl,
      collection,
      asset.id,
      {
        ...deployment.entity,
        ethAddress
      },
      logger
    )

    if (!hasAccess) {
      if (isL2)
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following item: (${asset.contractAddress}, ${asset.id})`
        )

      // L1 collections are deployed by Decentraland Address
      const isAllowlistedCollection = asset.uri.toString().startsWith('urn:decentraland:ethereum:collections-v1')
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress) || !isAllowlistedCollection) {
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following item: '${asset.uri}'`
        )
      }
    }
    return OK
  }
}
