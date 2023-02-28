import {
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../types'

/**
 * Validate that the signature belongs to the Ethereum address
 * @public
 */
export function createSignatureValidateFn(components: ContentValidatorComponents): ValidateFn {
  return async function validateFn(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const { entity, auditInfo } = deployment
    const validationResult = await components.externalCalls.validateSignature(entity.id, auditInfo, entity.timestamp)
    return !validationResult.ok ? validationFailed('The signature is invalid. ' + validationResult.message) : OK
  }
}
