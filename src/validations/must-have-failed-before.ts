import { conditionalValidation } from ".."

/** Make sure that the deployment actually failed, and that it can be re-deployed */
export default conditionalValidation({
  predicate: async ({ deployment, externalCalls }) =>
    await externalCalls.isFailedDeployment(deployment.entity.type, deployment.entity.id),
  message: () => "This entity was already marked as failed. You can't fix it",
})
