import { conditionalValidation } from '../types'

/**
 * Make sure that the deployment actually failed, and that it can be re-deployed
 * @public
 */
export const mustHaveFailedBefore = conditionalValidation({
  predicate: async ({ deployment, externalCalls }) =>
    await externalCalls.isFailedDeployment(deployment.entity.type, deployment.entity.id),
  message: () => "This entity was already marked as failed. You can't fix it",
})
