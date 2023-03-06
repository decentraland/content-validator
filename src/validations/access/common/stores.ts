import { OffChainAsset, parseUrn } from '@dcl/urn-resolver'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../../../types'

async function parseUrnNoFail(pointer: string): Promise<OffChainAsset | undefined> {
  try {
    const parsed = await parseUrn(pointer)
    if (!parsed || parsed?.type !== 'off-chain') return undefined
    return parsed
  } catch {}
}

/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export function createStoreValidateFn({
  externalCalls
}: Pick<ContentValidatorComponents, 'externalCalls'>): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const pointers = deployment.entity.pointers
    const ethAddress = externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1)
      return validationFailed(`Only one pointer is allowed when you create a Store. Received: ${pointers}`)

    const pointer: string = pointers[0].toLowerCase()
    const offchainAsset = await parseUrnNoFail(pointer)

    if (!offchainAsset)
      return validationFailed(
        `Store pointers should be a urn, for example (urn:decentraland:off-chain:marketplace-stores:{address}). Invalid pointer: ${pointer}`
      )

    if (offchainAsset.id !== ethAddress)
      return validationFailed(
        `You can only alter your own store. The pointer address and the signer address are different (address:${offchainAsset.id.toLowerCase()} signer: ${ethAddress.toLowerCase()}).`
      )

    return OK
  }
}
