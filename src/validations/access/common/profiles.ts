import { EthAddress } from '@dcl/schemas'
import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../../../types'

export function createPointerValidateFn(components: Pick<ContentValidatorComponents, 'externalCalls'>): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const pointers = deployment.entity.pointers
    const ethAddress = components.externalCalls.ownerAddress(deployment.auditInfo)

    if (pointers.length !== 1) {
      return validationFailed(`Only one pointer is allowed when you create a Profile. Received: ${pointers}`)
    }

    const pointer: string = pointers[0].toLowerCase()

    if (pointer.startsWith('default')) {
      if (!components.externalCalls.isAddressOwnedByDecentraland(ethAddress))
        return validationFailed(`Only Decentraland can add or modify default profiles`)
    } else if (!EthAddress.validate(pointer)) {
      return validationFailed(`The given pointer is not a valid ethereum address.`)
    } else if (pointer !== ethAddress.toLowerCase()) {
      return validationFailed(
        `You can only alter your own profile. The pointer address and the signer address are different (pointer:${pointer} signer: ${ethAddress.toLowerCase()}).`
      )
    }
    return OK
  }
}
