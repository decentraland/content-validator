import {
  BlockchainCollectionLinkedWearablesAsset,
  BlockchainCollectionThirdParty,
  BlockchainCollectionV1Asset,
  BlockchainCollectionV2Asset,
  OffChainAsset,
  parseUrn
} from '@dcl/urn-resolver'
import { LinkedWearableAssetValidateFn, ThirdPartyAssetValidateFn, V1andV2collectionAssetValidateFn } from '../../..'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../../../types'

export type ItemValidateFnComponents = Pick<ContentValidatorComponents, 'externalCalls'>

export type UrnType = SupportedAsset['type']

export type SupportedAsset =
  | BlockchainCollectionV1Asset
  | BlockchainCollectionV2Asset
  | OffChainAsset
  | BlockchainCollectionThirdParty
  | BlockchainCollectionLinkedWearablesAsset

function alreadySeen(resolvedPointers: SupportedAsset[], parsed: SupportedAsset): boolean {
  return resolvedPointers.some((alreadyResolved) => resolveSameUrn(alreadyResolved, parsed))
}

/**
 * This method returns true if the two assets are the same except for its uri.
 * For example, urns for collection v1 wearables can have a 'contractAddress' OR 'collectionName'
 * in the uri but reference the same asset.
 */
function resolveSameUrn(alreadyParsed: SupportedAsset, parsed: SupportedAsset): boolean {
  const { ['uri']: uri1, ...alreadyParsedWithoutUri } = alreadyParsed
  const { ['uri']: uri2, ...parsedWithoutUri } = parsed
  return JSON.stringify(parsedWithoutUri) === JSON.stringify(alreadyParsedWithoutUri)
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
    if (parsed?.type === 'blockchain-collection-linked-wearables-asset') {
      return parsed
    }
  } catch {}
  return null
}

export function createWearableValidateFn(
  components: ItemValidateFnComponents,
  v1andV2collectionAssetValidateFn: V1andV2collectionAssetValidateFn,
  thirdPartyAssetValidateFn: ThirdPartyAssetValidateFn,
  linkedWearableItemValidateFn: LinkedWearableAssetValidateFn
): ValidateFn {
  return createItemValidateFn(
    components,
    v1andV2collectionAssetValidateFn,
    thirdPartyAssetValidateFn,
    linkedWearableItemValidateFn,
    [
      'off-chain',
      'blockchain-collection-v1-asset',
      'blockchain-collection-v2-asset',
      'blockchain-collection-third-party',
      'blockchain-collection-linked-wearables-asset'
    ]
  )
}

export function createEmoteValidateFn(
  components: ItemValidateFnComponents,
  v1andV2collectionAssetValidateFn: V1andV2collectionAssetValidateFn,
  thirdPartyAssetValidateFn: ThirdPartyAssetValidateFn,
  linkedWearableItemValidateFn: LinkedWearableAssetValidateFn
): ValidateFn {
  return createItemValidateFn(
    components,
    v1andV2collectionAssetValidateFn,
    thirdPartyAssetValidateFn,
    linkedWearableItemValidateFn,
    [
      'off-chain',
      'blockchain-collection-v2-asset',
      'blockchain-collection-third-party',
      'blockchain-collection-linked-wearables-asset'
    ]
  )
}

export function createItemValidateFn(
  { externalCalls }: ItemValidateFnComponents,
  v1andV2collectionAssetValidateFn: V1andV2collectionAssetValidateFn,
  thirdPartyAssetValidateFn: ThirdPartyAssetValidateFn,
  linkedWearableAssetValidateFn: LinkedWearableAssetValidateFn,
  validUrnTypesForItem: UrnType[]
): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { pointers } = deployment.entity

    const resolvedPointers: SupportedAsset[] = []
    // deduplicate pointer resolution
    for (const pointer of pointers) {
      const parsed = await parseUrnNoFail(pointer)
      if (!parsed) {
        return validationFailed(
          `Item pointers should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{id}). Invalid pointer: (${pointer})`
        )
      }

      if (!alreadySeen(resolvedPointers, parsed)) {
        resolvedPointers.push(parsed)
      }
    }

    if (resolvedPointers.length > 1) {
      return validationFailed(`Only one pointer is allowed when you create an item. Received: ${pointers}`)
    }

    const parsedAsset = resolvedPointers[0]

    if (!validUrnTypesForItem.includes(parsedAsset.type)) {
      return validationFailed(
        `For the entity type: ${deployment.entity.type}, the asset with urn type: ${parsedAsset.type} is invalid. Valid urn types for this entity: ${validUrnTypesForItem}`
      )
    }

    if (parsedAsset.type === 'off-chain') {
      const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
      if (!externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(
          `The provided Eth Address '${ethAddress}' does not have access to the following item: '${parsedAsset.uri}'`
        )
      return OK
    } else if (
      parsedAsset.type === 'blockchain-collection-v1-asset' ||
      parsedAsset.type === 'blockchain-collection-v2-asset'
    ) {
      return v1andV2collectionAssetValidateFn(parsedAsset, deployment)
    } else if (parsedAsset.type === 'blockchain-collection-third-party') {
      return thirdPartyAssetValidateFn(parsedAsset, deployment)
    } else if (parsedAsset.type === 'blockchain-collection-linked-wearables-asset') {
      return linkedWearableAssetValidateFn(parsedAsset, deployment)
    } else {
      throw new Error('This should never happen. There is no validations for the asset.')
    }
  }
}
