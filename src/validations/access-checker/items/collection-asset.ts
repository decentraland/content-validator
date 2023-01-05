import { hashV0, hashV1 } from '@dcl/hashing'
import { BlockchainCollectionV1Asset, BlockchainCollectionV2Asset } from '@dcl/urn-resolver'
import { ContentValidatorComponents, DeploymentToValidate, OK, validationFailed } from '../../../types'
import { AssetValidation } from './items'

const L1_NETWORKS = ['mainnet', 'kovan', 'rinkeby', 'goerli']
const L2_NETWORKS = ['matic', 'mumbai']

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

export const v1andV2collectionAssetValidation: AssetValidation = {
  async validateAsset(
    components: Pick<ContentValidatorComponents, 'externalCalls' | 'logs' | 'theGraphClient' | 'subGraphs'>,
    asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
    deployment: DeploymentToValidate
  ) {
    const { externalCalls, subGraphs } = components
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const logger = components.logs.getLogger('collection asset access validation')
    const network = asset.network

    if (L1_NETWORKS.includes(network)) {
      // L1 collections are deployed by Decentraland Address
      const isAllowlistedCollection = asset.uri.toString().startsWith('urn:decentraland:ethereum:collections-v1')
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress) || !isAllowlistedCollection) {
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following item: '${asset.uri}'`
        )
      }
      return OK
    } else if (L2_NETWORKS.includes(network)) {
      const { timestamp, content, metadata } = deployment.entity

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

      const validateWearable = async (hash: string, block: number) => {
        return subGraphs.L2.checker.validateWearables(ethAddress, asset.contractAddress!, asset.id, hash, block)
      }

      let hasAccess = false
      try {
        const { blockAtDeployment, blockFiveMinBeforeDeployment } =
          await components.theGraphClient.findBlocksForTimestamp(timestamp, components.subGraphs.l2BlockSearch)

        // NOTE(hugo): I'm calculating both hashes so I can make one RPC request (they are processed together as a batch),
        // this may not be the right call, since it's possible to argue that a
        // hash call is more expensive than a RPC call, but since I have no
        // data to make a better decision, I think this is good enough
        const hashes = await calculateHashes()

        const batch: Promise<boolean>[] = []
        for (const hash of hashes) {
          if (blockAtDeployment) {
            batch.push(validateWearable(hash, blockAtDeployment))
          }
          if (blockFiveMinBeforeDeployment) {
            batch.push(validateWearable(hash, blockFiveMinBeforeDeployment))
          }
        }

        hasAccess = (await Promise.all(batch)).some((r) => r)
      } catch (err: any) {
        logger.error(err)
      }

      if (!hasAccess) {
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following item: (${asset.contractAddress}, ${asset.id})`
        )
      }
      return OK
    } else {
      return validationFailed(`Found an unknown network on the urn '${network}'`)
    }
  },
  canValidate(asset): asset is BlockchainCollectionV1Asset | BlockchainCollectionV2Asset {
    return asset.type === 'blockchain-collection-v1-asset' || asset.type === 'blockchain-collection-v2-asset'
  }
}
