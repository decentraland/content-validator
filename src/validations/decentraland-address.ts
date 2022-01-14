import { conditionalValidation, LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '..'

/**
 * Validate address is owned by decentraland when deployment is previous to DCL Launch
 * @public
 */
export const decentralandAddress = conditionalValidation({
  predicate: ({ deployment, externalCalls }) => {
    const { entity } = deployment
    const address = externalCalls.ownerAddress(deployment.auditInfo)
    if (entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP)
      return externalCalls.isAddressOwnedByDecentraland(address)
    return true
  },
  message: () => 'Expected an address owned by decentraland.',
})
