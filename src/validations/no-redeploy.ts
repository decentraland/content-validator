import { conditionalValidation } from '../types'

/** Validate if the entity can be re deployed or not */
export const noRedeploy = conditionalValidation({
  predicate: async ({ externalCalls }) => await externalCalls.isEntityDeployedAlready(),
  message: () => "This entity was already deployed. You can't redeploy it",
})
