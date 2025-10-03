import { EntityType, EthAddress, Outfits } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  ValidationResponse,
  validationFailed
} from '../types'
import { validateAfterADR244, validateAll, validateIfTypeMatches } from './validations'

export function createOutfitsPointerValidateFn(
  components: Pick<ContentValidatorComponents, 'externalCalls'>
): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const pointers = deployment.entity.pointers
    const ethAddress = components.externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1) {
      return validationFailed(`Only one pointer is allowed when you create an Outfits. Received: ${pointers}`)
    }

    const pointer: string = pointers[0].toLowerCase()
    const pointerParts = pointer.split(':')

    if (pointerParts.length !== 2) {
      return validationFailed('The pointer is not valid. It should be in the format: <address>:outfits')
    } else {
      const pointerAddress = pointerParts[0]
      if (pointerParts[1] !== 'outfits') {
        return validationFailed('The pointer is not valid. It should be in the format: <address>:outfits')
      } else if (!EthAddress.validate(pointerAddress)) {
        return validationFailed('The address of the given pointer is not a valid ethereum address.')
      } else if (pointerAddress !== ethAddress.toLowerCase()) {
        return validationFailed(
          `You can only alter your own outfits. The address of the pointer and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
        )
      }
    }
    return OK
  }
}

export async function outfitSlotsAreNotRepeatedValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const outfits = deployment.entity.metadata as Outfits
  const usedSlots = outfits.outfits.map((outfit) => outfit.slot)
  const uniqueSlots = new Set(usedSlots)
  if (usedSlots.length !== uniqueSlots.size) {
    return validationFailed('Outfits slots are repeated')
  }
  return OK
}

export async function outfitSlotsAreBetween0and9inclusiveValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const outfits = deployment.entity.metadata as Outfits
  const nonValidSlots = outfits.outfits.map((outfit) => outfit.slot).filter((slot) => slot < 0 || slot > 9)
  if (nonValidSlots.length > 0) {
    return validationFailed('Outfits slots are invalid, they must be between 0 and 9 inclusive')
  }
  return OK
}

export async function outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn(
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const outfits = deployment.entity.metadata as Outfits
  const extraOutfits = outfits.outfits.filter((outfit) => outfit.slot > 4)
  const expectedNumberOfNames = extraOutfits.length
  const numberOfUniqueNames = new Set(outfits.namesForExtraSlots).size
  if (numberOfUniqueNames !== expectedNumberOfNames) {
    return validationFailed(
      `There must be exactly one name for each extra slot. Provided ${numberOfUniqueNames} unique names but expected ${expectedNumberOfNames}`
    )
  }
  return OK
}

export const outfitsWearableUrnsIncludeTokenIdFn = validateAfterADR244(async function (
  deployment: DeploymentToValidate
): Promise<ValidationResponse> {
  const outfits = deployment.entity.metadata as Outfits
  const allWearables = outfits.outfits.map((outfit) => outfit.outfit.wearables).flat()

  const invalidUrns: string[] = []
  const nonItemUrns: string[] = []
  for (const wearableUrn of [...new Set(allWearables)]) {
    const parsed = await parseUrn(wearableUrn)
    if (!parsed) {
      invalidUrns.push(wearableUrn)
    } else if (parsed.type === 'blockchain-collection-v1-asset' || parsed.type === 'blockchain-collection-v2-asset') {
      nonItemUrns.push(wearableUrn)
    }
  }

  if (invalidUrns.length > 0) {
    return validationFailed(`Invalid wearable pointer: (${invalidUrns.join(', ')})`)
  }
  if (nonItemUrns.length > 0) {
    return validationFailed(
      `Wearable pointers ${nonItemUrns.join(', ')} should be items, not assets. The URNs must include the tokenId.`
    )
  }

  return OK
})

export function createOutfitsValidateFn(components: ContentValidatorComponents): ValidateFn {
  return validateIfTypeMatches(
    EntityType.OUTFITS,
    validateAll(
      createOutfitsPointerValidateFn(components),
      outfitSlotsAreNotRepeatedValidateFn,
      outfitsNumberOfNamesForExtraSlotsIsCorrectValidateFn,
      outfitsWearableUrnsIncludeTokenIdFn
    )
  )
}
