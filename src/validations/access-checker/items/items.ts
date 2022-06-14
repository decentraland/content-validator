import {
  BlockchainCollectionThirdParty,
  BlockchainCollectionV1Asset,
  BlockchainCollectionV2Asset,
  OffChainAsset,
  parseUrn
} from '@dcl/urn-resolver'
import { DeploymentToValidate } from '../../..'
import {
  ContentValidatorComponents,
  validationFailed,
  ValidationResponse
} from '../../../types'
import { v1andV2collectionAssetValidation } from './collection-asset'
import { offChainAssetValidation } from './off-chain-asset'
import { thirdPartyAssetValidation } from './third-party-asset'

export type UrnType =
  | 'off-chain'
  | 'blockchain-collection-v1-asset'
  | 'blockchain-collection-v2-asset'
  | 'blockchain-collection-third-party'

export type SupportedAsset =
  | BlockchainCollectionV1Asset
  | BlockchainCollectionV2Asset
  | OffChainAsset
  | BlockchainCollectionThirdParty

export type AssetValidation = {
  validateAsset(
    components: Pick<ContentValidatorComponents, 'externalCalls'>,
    asset: SupportedAsset,
    deployment: DeploymentToValidate
  ): ValidationResponse | Promise<ValidationResponse>
  canValidate(asset: SupportedAsset): boolean
}

const assetValidations = [
  offChainAssetValidation,
  v1andV2collectionAssetValidation,
  thirdPartyAssetValidation
]

function alreadySeen(
  resolvedPointers: SupportedAsset[],
  parsed: SupportedAsset
): boolean {
  return resolvedPointers.some((alreadyResolved) =>
    resolveSameUrn(alreadyResolved, parsed)
  )
}

function resolveSameUrn(
  alreadyParsed: SupportedAsset,
  parsed: SupportedAsset
): boolean {
  const alreadyParsedCopy = Object.assign({}, alreadyParsed)
  const parsedCopy = Object.assign({}, parsed)
  alreadyParsedCopy.uri = new URL('urn:same')
  parsedCopy.uri = new URL('urn:same')
  return JSON.stringify(alreadyParsedCopy) == JSON.stringify(parsedCopy)
}

async function parseUrnNoFail(urn: string): Promise<SupportedAsset | null> {
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

export const itemsValidation = {
  validate: async (
    components: Pick<
      ContentValidatorComponents,
      'externalCalls' | 'logs' | 'theGraphClient'
    >,
    deployment: DeploymentToValidate,
    validUrnTypesForItem: UrnType[]
  ) => {
    const logger = components.logs.getLogger('wearables access validator')

    const { pointers } = deployment.entity

    const resolvedPointers: SupportedAsset[] = []
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

    const parsedAsset = resolvedPointers[0]

    if (!validUrnTypesForItem.includes(parsedAsset.type)) {
      return validationFailed(
        `Could not resolve the contractAddress of the urn ${parsedAsset}`
      )
    }

    for (const validation of assetValidations) {
      if (validation.canValidate(parsedAsset)) {
        return validation.validateAsset(components, parsedAsset, deployment)
      }
    }
    throw new Error(
      'This should never happen. There is no validations for the asset.'
    )
  }
}
