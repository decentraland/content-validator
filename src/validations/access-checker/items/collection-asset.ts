import { hashV0, hashV1 } from '@dcl/hashing'
import { EthAddress } from '@dcl/schemas'
import { BlockchainCollectionV1Asset, BlockchainCollectionV2Asset } from '@dcl/urn-resolver'
import { ILoggerComponent } from '@well-known-components/interfaces'
import { ISubgraphComponent } from '@well-known-components/thegraph-component'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  EntityWithEthAddress,
  OK,
  validationFailed
} from '../../../types'
import { AssetValidation } from './items'

const L1_NETWORKS = ['mainnet', 'ropsten', 'kovan', 'rinkeby', 'goerli']
const L2_NETWORKS = ['matic', 'mumbai']

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
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
  subgraph: ISubgraphComponent,
  collection: string,
  itemId: string,
  block: number,
  logger: ILoggerComponent.ILogger
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

  const variables = {
    collection,
    itemId: `${collection}-${itemId}`,
    block
  }
  const result = await subgraph.query<ItemCollections>(query, variables)
  logger.info(`MARIANO() contentHash: variables ${JSON.stringify(variables)} result ${JSON.stringify(result)}`)

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
  components: Pick<ContentValidatorComponents, 'externalCalls'>,
  subgraph: ISubgraphComponent,
  collection: string,
  itemId: string,
  block: number,
  entity: EntityWithEthAddress,
  logger: ILoggerComponent.ILogger
): Promise<boolean> {
  try {
    const { content, metadata } = entity
    const permissions: ItemPermissionsData = await getCollectionItems(
      components,
      subgraph,
      collection,
      itemId,
      block,
      logger
    )
    const ethAddressLowercase = entity.ethAddress.toLowerCase()

    logger.info(`MARIANO(${entity.id}) contentHash: ${permissions.contentHash}`)
    if (!!permissions.contentHash) {
      const deployedByCommittee = permissions.committee.includes(ethAddressLowercase)
      if (!deployedByCommittee) {
        logger.info(`MARIANO(${entity.id}) The eth address ${ethAddressLowercase} is not part of committee.`)
      }
      const calculateHashes = () => {
        // Compare both by key and hash
        const compare = (a: { key: string; hash: string }, b: { key: string; hash: string }) => {
          if (a.hash > b.hash) return 1
          else if (a.hash < b.hash) return -1
          else return a.key > b.key ? 1 : -1
        }

        const contentAsJson = (content ?? []).map(({ file, hash }) => ({ key: file, hash })).sort(compare)
        const data = JSON.stringify({ content: contentAsJson, metadata })
        logger.info(`MARIANO(${entity.id}) data: ${data}`)
        const buffer = Buffer.from(data)
        return Promise.all([hashV0(buffer), hashV1(buffer)])
      }
      const hashes = await calculateHashes()
      const contentHashIsOk = hashes.includes(permissions.contentHash)
      if (!contentHashIsOk) {
        logger.info(
          `MARIANO(${entity.id}) The hash ${
            permissions.contentHash
          } doesn't match any of the calculated hashes: ${JSON.stringify(hashes)}. Content: ${JSON.stringify(content)}`
        )
      }
      return deployedByCommittee && contentHashIsOk
    } else {
      const b1 = permissions.collectionCreator && permissions.collectionCreator === ethAddressLowercase
      const b2 = permissions.collectionManagers && permissions.collectionManagers.includes(ethAddressLowercase)
      const b3 = permissions.itemManagers && permissions.itemManagers.includes(ethAddressLowercase)
      logger.info(`MARIANO(${entity.id}) b1: ${b1}, b2: ${b2}, b3: ${b3}`)
      const addressHasAccess = b1 || b2 || b3

      // Deployments to the content server are made after the collection is completed, so that the committee can then approve it.
      // That's why isCompleted must be true, but isApproved must be false. After the committee approves the wearable, there can't be any more changes
      const isCollectionValid = !permissions.isApproved && permissions.isCompleted

      return addressHasAccess && isCollectionValid
    }
  } catch (error) {
    logger.error(`Error checking permission for (${collection}-${itemId}) at block ${block}`)
    return false
  }
}

async function checkCollectionAccess(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'theGraphClient'>,
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
    logger.info(
      `MARIANO(${entity.id}) blockNumberAtDeployment ${blockNumberAtDeployment}, blockNumberFiveMinBeforeDeployment: ${blockNumberFiveMinBeforeDeployment}`
    )
    // It could happen that the subgraph hasn't synced yet, so someone who just lost access still managed to make a deployment. The problem would be that when other catalysts perform
    // the same check, the subgraph might have synced and the deployment is no longer valid. So, in order to prevent inconsistencies between catalysts, we will allow all deployments that
    // have access now, or had access 5 minutes ago.

    const hasPermissionOnBlock = async (blockNumber: number | undefined) =>
      !!blockNumber &&
      (await hasPermission(components, collectionsSubgraph, collection, itemId, blockNumber, entity, logger))
    const b1 = await hasPermissionOnBlock(blockNumberAtDeployment)
    if (b1) {
      return b1
    } else {
      logger.info(`MARIANO(${entity.id}) b1: ${b1}`)
    }
    const b2 = await hasPermissionOnBlock(blockNumberFiveMinBeforeDeployment)
    if (!b2) logger.info(`MARIANO(${entity.id}) b2: ${b2}`)
    return b2
  } catch (error) {
    logger.error(
      `Error checking wearable access (${collection}, ${itemId}, ${entity.ethAddress}, ${timestamp}, ${blocksSubgraph}).`
    )
    return false
  }
}

export const v1andV2collectionAssetValidation: AssetValidation = {
  async validateAsset(
    components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient' | 'subGraphs'>,
    asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
    deployment: DeploymentToValidate
  ) {
    const { externalCalls, subGraphs } = components
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const logger = components.logs.getLogger('collection asset access validation')
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
  },
  canValidate(asset): asset is BlockchainCollectionV1Asset | BlockchainCollectionV2Asset {
    return asset.type === 'blockchain-collection-v1-asset' || asset.type === 'blockchain-collection-v2-asset'
  }
}
