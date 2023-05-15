import { Outfits } from '@dcl/schemas'
import { parseUrn } from '@dcl/urn-resolver'
import {
  DeploymentToValidate,
  OK,
  OnChainAccessCheckerComponents,
  ValidateFn,
  ValidationResponse,
  validationFailed
} from '../../../types'
import { validateAll } from '../../validations'

export function createOutfitsWearablesOwnershipValidateFn({
  externalCalls,
  client
}: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'client'>): ValidateFn {
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
    const wearablesOwnershipResult = await client.ownsItemsAtTimestamp(
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

export function createOutfitsNamesOwnershipValidateFn({
  externalCalls,
  client
}: Pick<OnChainAccessCheckerComponents, 'externalCalls' | 'client'>): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)
    const namesForExtraSlots: string[] = deployment.entity.metadata.namesForExtraSlots
    const names = namesForExtraSlots.filter((name: string) => name && name.trim().length > 0)
    const namesCheckResult = await client.ownsNamesAtTimestamp(ethAddress, names, deployment.entity.timestamp)
    if (!namesCheckResult.result)
      return validationFailed(
        `The following names (${namesCheckResult.failing?.join(
          ', '
        )}) are not owned by the address ${ethAddress.toLowerCase()}).`
      )
    return OK
  }
}

export function createOutfitsValidateFn(components: Pick<OnChainAccessCheckerComponents, 'client' | 'externalCalls'>) {
  return validateAll(
    createOutfitsWearablesOwnershipValidateFn(components),
    createOutfitsNamesOwnershipValidateFn(components)
  )
}
