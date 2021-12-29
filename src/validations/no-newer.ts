import { conditionalValidation } from ".."

/** Validate that there are no newer deployments on the entity's pointers */
export default conditionalValidation({
  // Validate that pointers aren't referring to an entity with a higher timestamp
  predicate: async ({ deployment, externalCalls }) => await externalCalls.areThereNewerEntities(deployment.entity),
  message: () => "There is a newer entity pointed by one or more of the pointers you provided.",
})
