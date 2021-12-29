import { conditionalValidation } from ".."

/** Validate if the entity can be re deployed or not */
export default conditionalValidation({
  predicate: async ({ externalCalls }) => await externalCalls.isEntityDeployedAlready(),
  message: () => "This entity was already deployed. You can't redeploy it",
})
