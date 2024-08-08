import { BlockchainCollectionThirdParty, parseUrn } from '@dcl/urn-resolver'
import { L1_NETWORKS, L2_NETWORKS } from './types'

type URNsByNetwork = {
  ethereum: { urn: string; type: string }[]
  matic: { urn: string; type: string }[]
  ethereumThirdParty: { urn: string; type: string }[]
  maticThirdParty: { urn: string; type: string }[]
}

const ITEM_TYPES_TO_SPLIT = [
  'blockchain-collection-v1-asset',
  'blockchain-collection-v1-item',
  'blockchain-collection-v2-asset',
  'blockchain-collection-v2-item',
  'blockchain-collection-third-party',
  'blockchain-collection-third-party-item'
]

export async function splitItemsURNsByTypeAndNetwork(urnsToSplit: string[]): Promise<URNsByNetwork> {
  const ethereum: { urn: string; type: string }[] = []
  const matic: { urn: string; type: string }[] = []
  const ethereumThirdParty: { urn: string; type: string }[] = []
  const maticThirdParty: { urn: string; type: string }[] = []

  for (const urn of urnsToSplit) {
    const asset = await parseUrn(urn)
    if (!asset || !('network' in asset) || !ITEM_TYPES_TO_SPLIT.includes(asset.type)) {
      continue
    }

    // check if it is a L1 or L2 asset
    // 'ethereum' is included since L1 Mainnet assets include it instead of 'mainnet'
    if (![...L1_NETWORKS, 'ethereum'].includes(asset.network) && !L2_NETWORKS.includes(asset.network)) {
      continue
    }

    if ([...L1_NETWORKS, 'ethereum'].includes(asset.network)) {
      ethereum.push({ urn: asset.uri.toString(), type: asset.type })
    } else if (L2_NETWORKS.includes(asset.network)) {
      if (asset.type === 'blockchain-collection-third-party-item') {
        if (L1_NETWORKS.includes(asset.nftChain)) {
          ethereumThirdParty.push({ urn: asset.uri.toString(), type: asset.type })
        } else if (L2_NETWORKS.includes(asset.nftChain)) {
          maticThirdParty.push({ urn: asset.uri.toString(), type: asset.type })
        }
      } else if (asset.type === 'blockchain-collection-third-party') {
        maticThirdParty.push({ urn: asset.uri.toString(), type: asset.type })
      } else {
        matic.push({ urn: asset.uri.toString(), type: asset.type })
      }
    }
  }

  return {
    ethereum,
    matic,
    ethereumThirdParty,
    maticThirdParty
  }
}

export function getThirdPartyId(asset: BlockchainCollectionThirdParty): string {
  return `urn:decentraland:${asset.network}:collections-thirdparty:${asset.thirdPartyName}`
}

export function toHexBuffer(value: string): Buffer {
  if (value.startsWith('0x')) {
    return Buffer.from(value.substring(2), 'hex') // removing first 2 characters (0x)
  }
  return Buffer.from(value, 'hex')
}
