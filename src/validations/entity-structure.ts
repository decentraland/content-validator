import { DeploymentToValidate, OK, validationFailed, ValidationResponse } from '../types'

/**
 * Validate that entity is actually ok
 * @public
 */
export async function entityStructureValidationFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
  const { entity } = deployment
  if (new Set(entity.pointers).size !== entity.pointers.length) {
    return validationFailed('There are repeated pointers in your request.')
  } else if (!entity.pointers || entity.pointers.length <= 0) {
    return validationFailed('The entity needs to be pointed by one or more pointers.')
  }
  return OK
}
