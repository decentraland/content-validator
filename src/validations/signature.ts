import { ContentValidatorComponents, DeploymentToValidate, OK, validationFailed } from '../types'

/**
 * Validate that the signature belongs to the Ethereum address
 * @public
 */
export async function signature(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
  const { entity, auditInfo } = deployment
  const validationResult = await components.externalCalls.validateSignature(entity.id, auditInfo, entity.timestamp)
  return !validationResult.ok ? validationFailed('The signature is invalid. ' + validationResult.message) : OK
}
