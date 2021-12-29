import { OK, Validation, validationFailed } from "../types"

// todo: should we include signature result message?
const signature: Validation = {
  validate: async ({ deployment, externalCalls }) => {
    const { entity, auditInfo } = deployment
    const validationResult = await externalCalls.validateSignature(entity.id, auditInfo, entity.timestamp)
    return !validationResult.ok ? validationFailed("The signature is invalid. " + validationResult.message) : OK
  },
}

export default signature
