import { conditionalValidation } from '../types'

/**
 * Validate that the address used was owned by Decentraland
 * @public
 */
export const decentralandAddress = conditionalValidation({
  predicate: ({ deployment, externalCalls }) => {
    const address = externalCalls.ownerAddress(deployment.auditInfo)
    return externalCalls.isAddressOwnedByDecentraland(address)
  },
  message: ({ deployment, externalCalls }) => {
    const address = externalCalls.ownerAddress(deployment.auditInfo)
    return `Expected an address owned by decentraland. Instead, we found ${address}`
  },
})
