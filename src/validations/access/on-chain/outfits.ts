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

function createOutfitWearablesOwnershipValidateFn({
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
    const outfits: Outfits = deployment.entity.metadata.outfits
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

export function createOutfitsValidateFn(components: Pick<OnChainAccessCheckerComponents, 'client' | 'externalCalls'>) {
  return validateAll(createOutfitWearablesOwnershipValidateFn(components))
}
