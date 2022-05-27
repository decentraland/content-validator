import { OK, Validation, validationFailed } from '../types'

/**
 * Validate that the signature belongs to the Ethereum address
 * @public
 */
export const signature: Validation = {
  // todo: should we include signature result message?
  validate: async ({ deployment, externalCalls }) => {
    const { entity, auditInfo } = deployment
    const validationResult = await externalCalls.validateSignature(entity.id, auditInfo, entity.timestamp)
    return !validationResult.ok ? validationFailed('The signature is invalid. ' + validationResult.message) : OK
  }
}
