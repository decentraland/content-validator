import { hashV0, hashV1 } from '@dcl/hashing'
import { BlockchainCollectionV1Asset, BlockchainCollectionV2Asset } from '@dcl/urn-resolver'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  OnChainAccessCheckerComponents,
  validationFailed
} from '../../../types'
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
    {
      externalCalls,
      L2,
      client,
      logs
    }: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'logs' | 'client' | 'L2'>,
    asset: BlockchainCollectionV1Asset | BlockchainCollectionV2Asset,
    deployment: DeploymentToValidate
  ) {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const logger = logs.getLogger('collection asset access validation')
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

      const validateWearable = async (hashes: string[], block: number) => {
        try {
          return await L2.checker.validateWearables(ethAddress, asset.contractAddress!, asset.id, hashes, block)
        } catch (err: any) {
          logger.warn(err)
          return false
        }
      }

      let hasAccess = false
      const { blockNumberAtDeployment, blockNumberFiveMinBeforeDeployment } = await client.findBlocksForTimestamp(
        timestamp,
        L2.blockSearch
      )

      const hashes = await calculateHashes()

      if (blockNumberAtDeployment) {
        hasAccess = await validateWearable(hashes, blockNumberAtDeployment)
      }

      if (!hasAccess && blockNumberFiveMinBeforeDeployment) {
        hasAccess = await validateWearable(hashes, blockNumberFiveMinBeforeDeployment)
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
