import { parseUrn } from '@dcl/urn-resolver'
import { L1_NETWORKS, L2_NETWORKS } from './types'

type URNsByNetwork = {
  ethereum: { urn: string; type: string }[]
  matic: { urn: string; type: string }[]
}

const ITEM_TYPES_TO_SPLIT = [
  'blockchain-collection-v1-asset',
  'blockchain-collection-v1-item',
  'blockchain-collection-v2-asset',
  'blockchain-collection-v2-item'
]

export async function splitItemsURNsByNetwork(urnsToSplit: string[]): Promise<URNsByNetwork> {
  const ethereum: { urn: string; type: string }[] = []
  const matic: { urn: string; type: string }[] = []
  for (const urn of urnsToSplit) {
    // check if it is a L1 or L2 asset
    // 'ethereum' is included since L1 Mainnet assets includes it instead of 'mainnet'
    if (
      ![...L1_NETWORKS, 'ethereum'].some((network) => urn.includes(network)) &&
      !L2_NETWORKS.some((network) => urn.includes(network))
    ) {
      continue
    }

    const parsed = await parseUrn(urn)
    if (parsed && 'network' in parsed && ITEM_TYPES_TO_SPLIT.includes(parsed.type)) {
      if (L1_NETWORKS.includes(parsed.network)) {
        ethereum.push({ urn, type: parsed.type })
      } else if (L2_NETWORKS.includes(parsed.network)) {
        matic.push({ urn, type: parsed.type })
      }
    }
  }
  return {
    ethereum,
    matic
  }
}
