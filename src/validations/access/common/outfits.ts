import { Outfits } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  ItemsOwnership,
  NamesOwnership,
  OK,
  ValidateFn,
  ValidationResponse,
  validationFailed
} from '../../../types'

export function createOutfitsWearablesOwnershipValidateFn(
  { externalCalls }: Pick<ContentValidatorComponents, 'externalCalls'>,
  itemsOwnership: ItemsOwnership
): ValidateFn {
  async function sanitizeUrn(urn: string): Promise<string | undefined> {
    if (!urn.startsWith('dcl://')) {
      return urn
    }
    const parsed = await parseUrn(urn)
    return parsed?.uri?.toString()
  }

  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const outfits: Outfits = deployment.entity.metadata
    const allWearableUrns = outfits.outfits.map(({ outfit }) => outfit.wearables).flat()
    const sanitizedUrns = (await Promise.all(allWearableUrns.map((urn) => sanitizeUrn(urn)))).filter(
      (urn): urn is string => !!urn
    )
    const wearablesOwnershipResult = await itemsOwnership.ownsItemsAtTimestamp(
      ethAddress,
      sanitizedUrns,
      deployment.entity.timestamp
    )
    if (!wearablesOwnershipResult.result) {
      return validationFailed(
        `The following wearables (${wearablesOwnershipResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    }

    return OK
  }
}

export function createOutfitsNamesOwnershipValidateFn(
  { externalCalls }: Pick<ContentValidatorComponents, 'externalCalls'>,
  namesOwnership: NamesOwnership
): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const outfits = deployment.entity.metadata as Outfits
    const extraOutfits = outfits.outfits.filter((outfit) => outfit.slot > 4)
    if (extraOutfits.length > 0) {
      const namesCheckResult = await namesOwnership.ownsAnyNameAtTimestamp(ethAddress, deployment.entity.timestamp)
      if (!namesCheckResult.result)
        return validationFailed(`The address ${ethAddress.toLowerCase()} does not own any name.`)
    }
    return OK
  }
}
